/**
 * Generic Durable-Object persistence INTERFACES (the contracts a concrete DO's
 * storage layer implements). The realtime package owns no storage runtime; the
 * app-level DO (P2 chat Worker) implements these against SQLite. Kept minimal —
 * just what the generic appliers / outbox drain / allocators need.
 */

import type { StoredVersioned } from './apply.js';
import type { VersionedSyncItem } from './envelopes.js';
import type { AllocatorState } from './allocators.js';
import type { OutboxRow } from './sqlite-shapes.js';

/** Versioned record store keyed by a domain key (e.g. a projection pair / channel config). */
export interface VersionedStore {
  readVersioned(key: string): Promise<StoredVersioned | null>;
  writeVersioned(key: string, item: VersionedSyncItem): Promise<void>;
}

/** Monotonic allocator store (seqAllocator / messageRevAllocator). */
export interface AllocatorStore {
  read(id: string): Promise<AllocatorState | null>;
  write(id: string, state: AllocatorState): Promise<void>;
}

/** Outbox store backing at-least-once delivery with retry/dead-letter. */
export interface OutboxStore {
  enqueue(row: OutboxRow): Promise<void>;
  /** Rows with status 'pending' and nextAttemptAt <= now, up to `limit`. */
  claimDue(now: number, limit: number): Promise<OutboxRow[]>;
  markDelivered(id: string): Promise<void>;
  recordFailure(id: string, error: string, nextAttemptAt: number): Promise<void>;
  deadLetter(id: string, error: string): Promise<void>;
}
