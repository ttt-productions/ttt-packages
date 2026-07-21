// Shared injected contracts + tunable constants for the realtime transport.
//
// The client-agreed limits (`HEARTBEAT_MS`, `TYPING_COALESCE_MS`,
// `HISTORY_PAGE_MAX`) come from the one wire contract in
// `@ttt-productions/chat-schemas`; they are re-exported here so the transport's
// existing import sites are unchanged. The worker runtime is the authority and
// rejects anything out of bounds, but the client uses these to coalesce and
// paginate politely. The remaining constants below are client-only retry policy.

/**
 * Mints a short-lived chat grant token for the socket's scope. The app wires this
 * to its `mintChatGrant` callable (channel grant for a ChannelClient, inbox grant
 * for an InboxClient). Called on every connect AND once on a 4401 re-grant. The
 * app owns the Firestore permission check, the scope shape, caching to a React
 * Query staleTime < grant exp, and returning a FRESH token when re-invoked.
 */
export type GrantProvider = () => Promise<string>;

/**
 * Package-owned, Firebase-FREE terminal access-denial signal. A grant provider
 * throws this (from `GrantProvider`) when the authoritative authorization answer
 * is a genuine, terminal "no" — as opposed to a transient/retryable mint failure.
 *
 * The transport treats it specially: instead of the normal reconnect backoff it
 * STOPS reconnecting, closes the lifecycle, fails any pending optimistic sends,
 * and surfaces the stable `access-denied` error code (which the React hook maps to
 * `allowed: false` so the shell renders its no-access surface instead of an eternal
 * loader). Every other thrown error stays transient and reconnects as before.
 *
 * This is deliberately generic: the consuming app translates its own backend
 * denial (e.g. a Firebase `functions/permission-denied`) into this class at the
 * grant-provider boundary. The package never imports or names Firebase. Consumers
 * that cannot subclass may instead throw any error carrying `isChatAccessDenied:
 * true` — `isChatAccessDeniedError` recognizes both (also cross-realm safe).
 */
export class ChatAccessDeniedError extends Error {
  /** Duck-typed marker so detection survives module-realm / re-throw boundaries. */
  readonly isChatAccessDenied = true;
  constructor(message = 'Chat access denied') {
    super(message);
    this.name = 'ChatAccessDeniedError';
  }
}

/** True when `err` is a terminal chat access denial (class instance or duck-typed marker). */
export function isChatAccessDeniedError(err: unknown): err is ChatAccessDeniedError {
  return (
    err instanceof ChatAccessDeniedError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { isChatAccessDenied?: unknown }).isChatAccessDenied === true)
  );
}

/** Injectable timers so the transport runs deterministically under fake timers in tests. */
export interface TransportTimers {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (h: ReturnType<typeof setTimeout>) => void;
  now: () => number;
}

export const defaultTimers: TransportTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h),
  now: () => Date.now(),
};

/** Connection status surfaced to the UI. */
export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

// The client-agreed limits live in the wire contract; re-export to keep this
// module's public surface stable.
export { HEARTBEAT_MS, TYPING_COALESCE_MS, HISTORY_PAGE_MAX } from '@ttt-productions/chat-schemas';

/**
 * Max reconnect resends of one un-acked send before its optimistic row is flipped
 * to a visible failed state (retry affordance) instead of a permanent ghost. Each
 * reconnect that resumes with the pending send still un-acked counts one attempt.
 */
export const MAX_PENDING_SEND_ATTEMPTS = 5;

/**
 * Max wall-clock age of an un-acked pending send before it is flipped to failed on
 * the next resume, even if the attempt cap hasn't been hit (a long offline window).
 */
export const PENDING_SEND_MAX_AGE_MS = 60_000;

/**
 * Wall-clock budget (ms) for a SERVER-DECLARED retryable send. Once the Worker has
 * rejected a send as retryable — a correlated `send-rejected` frame OR the legacy
 * uncorrelated `error{code:'membership-pending'}` — that send keeps retrying on the
 * server's own hint until this budget elapses, and is NEVER failed by the generic
 * {@link MAX_PENDING_SEND_ATTEMPTS} cap (which governs only blind reconnect
 * resends). 90 s comfortably covers the backend projection/grant-bootstrap window
 * without stranding an optimistic bubble on "Sending…" the way the old ~10 s
 * five-attempt cap did.
 */
export const SERVER_RETRYABLE_MAX_AGE_MS = 90_000;

/**
 * Lower/upper clamp (ms) applied to a server `retryAfterMs` hint before scheduling a
 * resend, so a pathological (but schema-valid) hint can neither hammer the socket
 * nor park a send for minutes.
 */
export const SEND_RETRY_MIN_DELAY_MS = 250;
export const SEND_RETRY_MAX_DELAY_MS = 30_000;
