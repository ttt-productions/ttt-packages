const BOOT_LOOKUP_URL_FRAGMENT = 'identitytoolkit.googleapis.com/v1/accounts:lookup';

const BOOT_TOKEN_REFRESH_URL_FRAGMENT = 'securetoken.googleapis.com/v1/token';

const INSTALLED_FLAG = '__FIREBASE_AUTH_BOOT_LOOKUP_GUARD__';

const DEFAULT_RETRY_DELAYS_MS = [400, 1200] as const;

export type BootLookupFailureClass = 'identity' | 'attestation' | 'network' | 'transient';

const SERVER_ERROR_TO_AUTH_CODE: Readonly<Record<string, string>> = {
  INVALID_ID_TOKEN: 'auth/invalid-user-token',
  TOKEN_EXPIRED: 'auth/user-token-expired',
  USER_NOT_FOUND: 'auth/user-token-expired',
  USER_DISABLED: 'auth/user-disabled',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'auth/requires-recent-login',
};

const IDENTITY_AUTH_CODES: ReadonlySet<string> = new Set([
  'auth/invalid-user-token',
  'auth/user-token-expired',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/requires-recent-login',
]);

let lastFailureClass: BootLookupFailureClass | null = null;
let uninstall: (() => void) | undefined;

export function getLastBootLookupFailureClass(): BootLookupFailureClass | null {
  return lastFailureClass;
}

export function classifyBootLookupFailure({
  status,
  message,
}: {
  status: number;
  message: string;
}): BootLookupFailureClass {
  if (/app\s*-?\s*check/i.test(message)) return 'attestation';

  const serverErrorCode = message.split(' : ')[0].trim();
  const authCode = SERVER_ERROR_TO_AUTH_CODE[serverErrorCode];
  if (authCode && IDENTITY_AUTH_CODES.has(authCode)) return 'identity';

  if (status === 401) return 'attestation';

  return 'transient';
}

export interface BootLookupResponse {
  ok: boolean;
  status: number;
  clone: () => { json: () => Promise<unknown> };
}

export interface GuardedBootLookupOptions<TResponse extends BootLookupResponse> {
  attempt: () => Promise<TResponse>;
  refreshAttestation?: () => Promise<void>;
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  onFailure?: (failureClass: BootLookupFailureClass) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readErrorMessage(response: BootLookupResponse): Promise<string> {
  try {
    const body = (await response.clone().json()) as {
      error?: { message?: unknown };
      errorMessage?: unknown;
    };
    const message = body.error?.message ?? body.errorMessage;
    return typeof message === 'string' ? message : '';
  } catch {
    return '';
  }
}

async function runGuardedBootRequest<TResponse extends BootLookupResponse>(
  requestName: string,
  options: GuardedBootLookupOptions<TResponse>,
): Promise<TResponse> {
  const delays = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;

  let failureClass: BootLookupFailureClass = 'transient';

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) {
      await sleep(delays[attempt - 1]);
      if (failureClass === 'attestation') await options.refreshAttestation?.();
    }

    let response: TResponse | undefined;
    let transportError: unknown;
    try {
      response = await options.attempt();
    } catch (error) {
      transportError = error;
    }

    if (!response) {
      failureClass = 'network';
      options.onFailure?.(failureClass);
      if (attempt === delays.length) throw transportError;
      continue;
    }

    if (response.ok) return response;

    failureClass = classifyBootLookupFailure({
      status: response.status,
      message: await readErrorMessage(response),
    });
    options.onFailure?.(failureClass);

    if (failureClass === 'identity') return response;
  }

  // The SDK maps a thrown non-FirebaseError to `auth/network-request-failed`.
  throw new Error(
    `Boot ${requestName} kept failing (${failureClass}) — keeping the persisted session`,
  );
}

export function runGuardedBootLookup<TResponse extends BootLookupResponse>(
  options: GuardedBootLookupOptions<TResponse>,
): Promise<TResponse> {
  return runGuardedBootRequest('accounts:lookup', options);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return typeof input.url === 'string' ? input.url : '';
}

export function installAuthBootLookupGuard(
  options: { refreshAttestation?: () => Promise<void> } = {},
): void {
  if (typeof window === 'undefined') return;

  const globalScope = globalThis as Record<string, unknown>;
  if (globalScope[INSTALLED_FLAG]) return;
  globalScope[INSTALLED_FLAG] = true;

  const unguardedFetch = window.fetch;
  const originalFetch = unguardedFetch.bind(window);
  let bootLookupHandled = false;
  let bootTokenRefreshHandled = false;
  const guard = (requestName: string, input: RequestInfo | URL, init?: RequestInit) =>
    runGuardedBootRequest(requestName, {
      attempt: () => originalFetch(input, init),
      refreshAttestation: options.refreshAttestation,
      onFailure: (failureClass) => {
        lastFailureClass = failureClass;
      },
    });

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    // The SDK's boot reload refreshes an expired persisted ID token before its lookup; a refresh
    // after the boot lookup, or after the first one, belongs to the running session.
    if (
      !bootLookupHandled &&
      !bootTokenRefreshHandled &&
      url.includes(BOOT_TOKEN_REFRESH_URL_FRAGMENT)
    ) {
      bootTokenRefreshHandled = true;
      return guard('token refresh', input, init);
    }
    if (bootLookupHandled || !url.includes(BOOT_LOOKUP_URL_FRAGMENT)) {
      return originalFetch(input, init);
    }
    bootLookupHandled = true;
    return guard('accounts:lookup', input, init);
  }) as typeof window.fetch;
  uninstall = () => {
    window.fetch = unguardedFetch;
  };
}

export function __resetAuthBootLookupGuard(): void {
  uninstall?.();
  uninstall = undefined;
  lastFailureClass = null;
  (globalThis as Record<string, unknown>)[INSTALLED_FLAG] = undefined;
}
