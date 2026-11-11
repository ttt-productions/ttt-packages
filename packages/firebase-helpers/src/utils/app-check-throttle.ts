export const APP_CHECK_THROTTLE_CODES = [
  'appCheck/throttled',
  'appCheck/initial-throttle',
] as const;

export type AppCheckThrottleCode = (typeof APP_CHECK_THROTTLE_CODES)[number];

// A callable that needs a limited-use token asks App Check for it before anything goes on the wire,
// so any of these on a callable's rejection means the request was never sent.
export const APP_CHECK_NEVER_SENT_CODES = {
  connectionFailed: ['appCheck/fetch-network-error'],
  tokenFailed: [
    ...APP_CHECK_THROTTLE_CODES,
    'appCheck/fetch-status-error',
    'appCheck/fetch-parse-error',
    'appCheck/recaptcha-error',
    'appCheck/use-before-activation',
  ],
} as const;

export type AppCheckNeverSentKind = keyof typeof APP_CHECK_NEVER_SENT_CODES;

export type AppCheckNeverSentCode =
  (typeof APP_CHECK_NEVER_SENT_CODES)[AppCheckNeverSentKind][number];

const THROTTLE_SET: ReadonlySet<string> = new Set(APP_CHECK_THROTTLE_CODES);
const CONNECTION_FAILED_SET: ReadonlySet<string> = new Set(
  APP_CHECK_NEVER_SENT_CODES.connectionFailed,
);
const TOKEN_FAILED_SET: ReadonlySet<string> = new Set(APP_CHECK_NEVER_SENT_CODES.tokenFailed);

function hasCodeIn(error: unknown, codes: ReadonlySet<string>): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && codes.has(code);
}

export function isAppCheckThrottleError(error: unknown): boolean {
  return hasCodeIn(error, THROTTLE_SET);
}

export function isAppCheckConnectionFailure(error: unknown): boolean {
  return hasCodeIn(error, CONNECTION_FAILED_SET);
}

export function isAppCheckTokenFailure(error: unknown): boolean {
  return hasCodeIn(error, TOKEN_FAILED_SET);
}
