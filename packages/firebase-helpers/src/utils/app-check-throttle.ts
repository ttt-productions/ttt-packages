// The ONE declaration of the App Check "provider is backing off" error codes.
// The App Check provider keeps an in-memory throttle window after an exchange
// failure (a 403 from the attestation endpoint sets a 24h backoff): the call
// that trips it rejects with `appCheck/initial-throttle`, and every later token
// request rejects with `appCheck/throttled` before any network work happens.
// Generic Firebase codes — app-agnostic, so they live here beside the
// expected-callable-answer set rather than in an app-data package.

/** Bare App Check throttle codes as the SDK reports them (`FirebaseError.code`). */
export const APP_CHECK_THROTTLE_CODES = [
  'appCheck/throttled',
  'appCheck/initial-throttle',
] as const;

export type AppCheckThrottleCode = (typeof APP_CHECK_THROTTLE_CODES)[number];

const THROTTLE_SET: ReadonlySet<string> = new Set(APP_CHECK_THROTTLE_CODES);

/**
 * Is this rejection the App Check provider refusing to mint a token because it
 * is inside its own backoff window? True for both the call that opens the
 * window (`appCheck/initial-throttle`) and every call refused by it
 * (`appCheck/throttled`).
 *
 * Both are thrown BEFORE any request reaches the wire, which is what makes a
 * retry on this class safe for non-idempotent work.
 */
export function isAppCheckThrottleError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && THROTTLE_SET.has(code);
}
