/**
 * v1 SQLite GENERIC table row shapes (Contract D). These are runtime-neutral
 * TypeScript shapes — the concrete Durable Object (app-level, e.g. the chat
 * Worker) maps them to actual SQLite DDL and adds any app columns. The realtime
 * package owns the generic SHAPES so the allocator / outbox / projection
 * primitives can be typed against them without knowing the domain.
 */

/** seqAllocator singleton row — monotonic sequence per stream. */
export interface SeqAllocatorRow {
  id: string;
  lastSeq: number;
}

/** messageRevAllocator singleton row — monotonic message revision. */
export interface MessageRevAllocatorRow {
  id: string;
  lastRevision: number;
}

/**
 * unreadProjection row — per-recipient coalesced unread state with the focus
 * lease/hysteresis fields. `lastEmittedProjectionEventId` mirrors the last
 * emitted event (the never-pruned allocator is the version authority).
 */
export interface UnreadProjectionRow {
  recipientUid: string;
  /** App-defined unread semantics (flag or count). */
  unread: number;
  lastEmittedProjectionEventId: string | null;
  /** dueWork debounce state (null = no pending work). */
  dueWorkState: string | null;
  focusLeaseUntil: number | null;
  focusLeaseMaxUntil: number | null;
}

/** Generic outbox row (channel/inbox outbox) — at-least-once delivery with dead-letter. */
export interface OutboxRow {
  /** Idempotency key (command/event id). */
  id: string;
  kind: string;
  /** Serialized payload (app-encoded). */
  payload: string;
  status: 'pending' | 'delivered' | 'deadLetter';
  attemptCount: number;
  nextAttemptAt: number;
  lastError: string | null;
  createdAt: number;
}
