/**
 * Bounded resubscribe ladder for realtime Firestore listeners.
 *
 * A subscription that dies on a `permission-denied` listener error never retries on
 * its own. In practice this fires transiently mid-session: the App Check token
 * expires ~1h in and the SDK's silent refresh mint can fail (e.g. the refresh hits
 * the reCAPTCHA bot-score throttle), so an active `onSnapshot` errors with
 * `permission-denied` even though the user is still authorized. Without a retry the
 * widget stays permanently dead until a full reload.
 *
 * These delays (ms) are the backoff between resubscribe attempts. After the last
 * one the error surfaces exactly as it did before. While the ladder runs the
 * consumer keeps its last-known data and reads `sourceState: 'connecting'`; a
 * healthy snapshot resets the ladder so a later blip gets a fresh window.
 */
export const RESUBSCRIBE_DELAYS_MS = [5_000, 15_000, 45_000] as const;

/**
 * True for a Firestore `permission-denied` listener error — the only code the
 * subscription hooks bounded-retry (a failed token refresh heals within seconds).
 * Keys off the `FirestoreError.code`, never the message.
 */
export function isPermissionDeniedError(error: unknown): boolean {
  return (error as { code?: string } | null | undefined)?.code === 'permission-denied';
}
