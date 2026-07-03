// Shared injected contracts + tunable constants for the realtime transport.
//
// The constants mirror the worker's V1 limits (`ttt-master-app/chat-worker/src/
// limits.ts`) for the values the CLIENT must agree on. They are duplicated (not
// imported) on purpose — this package is generic and never imports the worker;
// the worker is the authority and rejects anything out of bounds, so a drift is
// caught server-side, but the client uses these to coalesce/paginate politely.

/**
 * Mints a short-lived chat grant token for the socket's scope. The app wires this
 * to its `mintChatGrant` callable (channel grant for a ChannelClient, inbox grant
 * for an InboxClient). Called on every connect AND once on a 4401 re-grant. The
 * app owns the Firestore permission check, the scope shape, caching to a React
 * Query staleTime < grant exp, and returning a FRESH token when re-invoked.
 */
export type GrantProvider = () => Promise<string>;

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

/** Client heartbeat cadence (worker `CLIENT_HEARTBEAT_MS`). */
export const HEARTBEAT_MS = 20_000;
/** Typing coalescing minimum interval (worker `TYPING_COALESCE_MS`). */
export const TYPING_COALESCE_MS = 2_000;
/** History page cap (worker `HISTORY_PAGE_MAX`). */
export const HISTORY_PAGE_MAX = 50;

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
