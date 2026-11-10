import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  __resetAuthBootLookupGuard,
  classifyBootLookupFailure,
  getLastBootLookupFailureClass,
  installAuthBootLookupGuard,
  runGuardedBootLookup,
  type BootLookupFailureClass,
  type BootLookupResponse,
} from '../src/client/auth-boot-lookup-guard.js';

const instantSleep = vi.fn(async () => undefined);

function errorResponse(status: number, message: string): BootLookupResponse {
  return {
    ok: false,
    status,
    clone: () => ({ json: async () => ({ error: { code: status, message } }) }),
  };
}

const okResponse: BootLookupResponse = {
  ok: true,
  status: 200,
  clone: () => ({ json: async () => ({}) }),
};

// The shapes @firebase/auth's SERVER_ERROR_MAP and _performFetchWithErrorHandling produce.
const APP_CHECK_401 = 'Firebase App Check token is invalid.';
const INVALID_ID_TOKEN = 'INVALID_ID_TOKEN';
const TOKEN_EXPIRED = 'TOKEN_EXPIRED';
const USER_DISABLED = 'USER_DISABLED : the account has been disabled';
const MISSING_PROJECT_ID = 'MISSING_PROJECT_ID';

describe('classifyBootLookupFailure', () => {
  it('classes the App Check 401 as attestation, not identity', () => {
    expect(classifyBootLookupFailure({ status: 401, message: APP_CHECK_401 })).toBe('attestation');
  });

  it('classes a bare 401 with no readable body as attestation', () => {
    expect(classifyBootLookupFailure({ status: 401, message: '' })).toBe('attestation');
  });

  it.each([
    ['auth/invalid-user-token', INVALID_ID_TOKEN],
    ['auth/user-token-expired', TOKEN_EXPIRED],
    ['auth/user-token-expired', 'USER_NOT_FOUND'],
    ['auth/user-disabled', USER_DISABLED],
    ['auth/requires-recent-login', 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN'],
  ])('classes %s (%s) as identity', (_authCode, serverMessage) => {
    expect(classifyBootLookupFailure({ status: 400, message: serverMessage })).toBe('identity');
  });

  it('classes a Google-side 400 on a valid token as transient, not identity', () => {
    expect(classifyBootLookupFailure({ status: 400, message: MISSING_PROJECT_ID })).toBe(
      'transient',
    );
  });

  it('classes a 5xx as transient', () => {
    expect(classifyBootLookupFailure({ status: 503, message: 'backend unavailable' })).toBe(
      'transient',
    );
  });
});

describe('runGuardedBootLookup', () => {
  it('IDENTITY failure: returns the response untouched so the SDK purges — no retry', async () => {
    const response = errorResponse(400, INVALID_ID_TOKEN);
    const attempt = vi.fn(async () => response);
    const onFailure = vi.fn<(failureClass: BootLookupFailureClass) => void>();

    await expect(
      runGuardedBootLookup({ attempt, sleep: instantSleep, onFailure, delaysMs: [1, 2] }),
    ).resolves.toBe(response);

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith('identity');
  });

  it('ATTESTATION failure: retries with a fresh App Check token and recovers — session kept, no purge', async () => {
    const attempt = vi
      .fn<() => Promise<BootLookupResponse>>()
      .mockResolvedValueOnce(errorResponse(401, APP_CHECK_401))
      .mockResolvedValueOnce(okResponse);
    const refreshAttestation = vi.fn(async () => undefined);
    const sleep = vi.fn(async (_ms: number) => undefined);

    await expect(
      runGuardedBootLookup({ attempt, refreshAttestation, sleep, delaysMs: [10, 20] }),
    ).resolves.toBe(okResponse);

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(refreshAttestation).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([10]);
  });

  it('ATTESTATION failure that never clears: throws so the SDK reads network and KEEPS the session', async () => {
    const attempt = vi.fn(async () => errorResponse(401, APP_CHECK_401));
    const refreshAttestation = vi.fn(async () => undefined);

    await expect(
      runGuardedBootLookup({
        attempt,
        refreshAttestation,
        sleep: instantSleep,
        delaysMs: [10, 20],
      }),
    ).rejects.toThrow(/attestation/);

    expect(attempt).toHaveBeenCalledTimes(3);
    expect(refreshAttestation).toHaveBeenCalledTimes(2);
  });

  it('ATTESTATION first, IDENTITY on retry: purges after all', async () => {
    const identity = errorResponse(400, TOKEN_EXPIRED);
    const attempt = vi
      .fn<() => Promise<BootLookupResponse>>()
      .mockResolvedValueOnce(errorResponse(401, APP_CHECK_401))
      .mockResolvedValueOnce(identity);
    const onFailure = vi.fn<(failureClass: BootLookupFailureClass) => void>();

    await expect(
      runGuardedBootLookup({ attempt, sleep: instantSleep, onFailure, delaysMs: [10, 20] }),
    ).resolves.toBe(identity);

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(onFailure.mock.calls.map((c) => c[0])).toEqual(['attestation', 'identity']);
  });

  it('NETWORK failure: retries and recovers — session kept, no purge', async () => {
    const attempt = vi
      .fn<() => Promise<BootLookupResponse>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okResponse);
    const refreshAttestation = vi.fn(async () => undefined);
    const onFailure = vi.fn<(failureClass: BootLookupFailureClass) => void>();

    await expect(
      runGuardedBootLookup({
        attempt,
        refreshAttestation,
        sleep: instantSleep,
        onFailure,
        delaysMs: [10, 20],
      }),
    ).resolves.toBe(okResponse);

    expect(attempt).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith('network');
    expect(refreshAttestation).not.toHaveBeenCalled();
  });

  it('NETWORK failure that never clears: rethrows the transport error — the SDK keeps the session', async () => {
    const transportError = new TypeError('Failed to fetch');
    const attempt = vi.fn(async () => {
      throw transportError;
    });

    await expect(
      runGuardedBootLookup({ attempt, sleep: instantSleep, delaysMs: [10, 20] }),
    ).rejects.toBe(transportError);

    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it('a transient Google-side 400 is retried, never purged', async () => {
    const attempt = vi
      .fn<() => Promise<BootLookupResponse>>()
      .mockResolvedValueOnce(errorResponse(400, MISSING_PROJECT_ID))
      .mockResolvedValueOnce(okResponse);

    await expect(
      runGuardedBootLookup({ attempt, sleep: instantSleep, delaysMs: [10, 20] }),
    ).resolves.toBe(okResponse);

    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it('a successful lookup returns immediately with no classification', async () => {
    const attempt = vi.fn(async () => okResponse);
    const onFailure = vi.fn<(failureClass: BootLookupFailureClass) => void>();

    await expect(runGuardedBootLookup({ attempt, sleep: instantSleep, onFailure })).resolves.toBe(
      okResponse,
    );

    expect(attempt).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
  });
});

const LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=k';
const TOKEN_URL = 'https://securetoken.googleapis.com/v1/token?key=k';
const REFRESH_INIT: RequestInit = {
  method: 'POST',
  body: 'grant_type=refresh_token&refresh_token=r',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function refusal(status: number, message: string): Response {
  return jsonResponse(status, { error: { code: status, message, status: 'INVALID_ARGUMENT' } });
}

const refreshed = () =>
  jsonResponse(200, { access_token: 'a', refresh_token: 'r', expires_in: '3600' });

type OriginalFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function installGuardOver(
  originalFetch: OriginalFetch,
  refreshAttestation?: () => Promise<void>,
): OriginalFetch {
  const fakeWindow = { fetch: originalFetch };
  (globalThis as Record<string, unknown>).window = fakeWindow;
  installAuthBootLookupGuard({ refreshAttestation });
  return fakeWindow.fetch;
}

async function settle<T>(pending: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return pending;
}

describe('installAuthBootLookupGuard — the boot token refresh', () => {
  beforeEach(() => {
    __resetAuthBootLookupGuard();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetAuthBootLookupGuard();
    delete (globalThis as Record<string, unknown>).window;
  });

  it.each([TOKEN_EXPIRED, USER_DISABLED, 'USER_NOT_FOUND'])(
    'returns a boot refresh refused with %s untouched, classed identity and never retried',
    async (serverMessage) => {
      const refused = refusal(400, serverMessage);
      const originalFetch = vi.fn<OriginalFetch>(async () => refused);
      const fetch = installGuardOver(originalFetch);

      await expect(settle(fetch(TOKEN_URL, REFRESH_INIT))).resolves.toBe(refused);

      expect(originalFetch).toHaveBeenCalledTimes(1);
      expect(getLastBootLookupFailureClass()).toBe('identity');
    },
  );

  it.each([
    ['a 5xx', () => refusal(503, 'backend unavailable')],
    ['a 429', () => refusal(429, 'TOO_MANY_ATTEMPTS_TRY_LATER')],
  ])(
    'retries a boot refresh that fails with %s after the lookup delays and returns the recovery',
    async (_label, failure) => {
      const recovered = refreshed();
      const originalFetch = vi
        .fn<OriginalFetch>()
        .mockResolvedValueOnce(failure())
        .mockResolvedValueOnce(failure())
        .mockResolvedValueOnce(recovered);
      const fetch = installGuardOver(originalFetch);

      const pending = fetch(TOKEN_URL, REFRESH_INIT);
      await vi.advanceTimersByTimeAsync(399);
      expect(originalFetch).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(originalFetch).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1199);
      expect(originalFetch).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);

      await expect(pending).resolves.toBe(recovered);
      expect(originalFetch).toHaveBeenCalledTimes(3);
    },
  );

  it('resends the same request on every retry', async () => {
    const originalFetch = vi
      .fn<OriginalFetch>()
      .mockResolvedValueOnce(refusal(503, 'backend unavailable'))
      .mockResolvedValueOnce(refreshed());
    const fetch = installGuardOver(originalFetch);

    await settle(fetch(TOKEN_URL, REFRESH_INIT));

    expect(originalFetch.mock.calls).toEqual([
      [TOKEN_URL, REFRESH_INIT],
      [TOKEN_URL, REFRESH_INIT],
    ]);
  });

  it('refreshes attestation before retrying a boot refresh App Check refused', async () => {
    const order: string[] = [];
    const originalFetch = vi
      .fn<OriginalFetch>()
      .mockImplementationOnce(async () => {
        order.push('refresh');
        return refusal(401, APP_CHECK_401);
      })
      .mockImplementationOnce(async () => {
        order.push('refresh');
        return refreshed();
      });
    const refreshAttestation = vi.fn(async () => {
      order.push('attestation');
    });
    const fetch = installGuardOver(originalFetch, refreshAttestation);

    await settle(fetch(TOKEN_URL, REFRESH_INIT));

    expect(order).toEqual(['refresh', 'attestation', 'refresh']);
  });

  it('keeps the session when the boot refresh never recovers: throws a non-Firebase error and leaves the class set', async () => {
    const originalFetch = vi.fn<OriginalFetch>(async () => refusal(503, 'backend unavailable'));
    const fetch = installGuardOver(originalFetch);

    const outcome = expect(fetch(TOKEN_URL, REFRESH_INIT)).rejects.toThrow(
      'Boot token refresh kept failing (transient) — keeping the persisted session',
    );
    await vi.runAllTimersAsync();
    await outcome;

    expect(originalFetch).toHaveBeenCalledTimes(3);
    expect(getLastBootLookupFailureClass()).toBe('transient');
  });

  it('rethrows the transport error when the boot refresh never reaches the server', async () => {
    const transportError = new TypeError('Failed to fetch');
    const originalFetch = vi.fn<OriginalFetch>(async () => {
      throw transportError;
    });
    const fetch = installGuardOver(originalFetch);

    const outcome = expect(fetch(TOKEN_URL, REFRESH_INIT)).rejects.toBe(transportError);
    await vi.runAllTimersAsync();
    await outcome;

    expect(originalFetch).toHaveBeenCalledTimes(3);
    expect(getLastBootLookupFailureClass()).toBe('network');
  });

  it('leaves the class unset when the boot refresh succeeds', async () => {
    const fetch = installGuardOver(async () => refreshed());

    await settle(fetch(TOKEN_URL, REFRESH_INIT));

    expect(getLastBootLookupFailureClass()).toBeNull();
  });

  it('neither retries nor classes a refresh refused after the boot lookup', async () => {
    const originalFetch = vi.fn<OriginalFetch>(async (input) =>
      String(input).startsWith(LOOKUP_URL)
        ? jsonResponse(200, { users: [{}] })
        : refusal(503, 'backend unavailable'),
    );
    const fetch = installGuardOver(originalFetch);

    await settle(fetch(LOOKUP_URL));
    await settle(fetch(TOKEN_URL, REFRESH_INIT));

    expect(originalFetch).toHaveBeenCalledTimes(2);
    expect(getLastBootLookupFailureClass()).toBeNull();
  });

  it('neither retries nor classes a refresh after the boot refresh', async () => {
    const originalFetch = vi
      .fn<OriginalFetch>()
      .mockResolvedValueOnce(refreshed())
      .mockResolvedValueOnce(refusal(400, TOKEN_EXPIRED));
    const fetch = installGuardOver(originalFetch);

    await settle(fetch(TOKEN_URL, REFRESH_INIT));
    await settle(fetch(TOKEN_URL, REFRESH_INIT));

    expect(originalFetch).toHaveBeenCalledTimes(2);
    expect(getLastBootLookupFailureClass()).toBeNull();
  });

  it('still guards the boot lookup that follows a successful boot refresh', async () => {
    const fetch = installGuardOver(async (input) =>
      String(input).startsWith(LOOKUP_URL) ? refusal(400, INVALID_ID_TOKEN) : refreshed(),
    );

    await settle(fetch(TOKEN_URL, REFRESH_INIT));
    await settle(fetch(LOOKUP_URL));

    expect(getLastBootLookupFailureClass()).toBe('identity');
  });
});
