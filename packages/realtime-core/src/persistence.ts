import type { StoredVersioned } from './apply.js';
import type { VersionedSyncItem } from './envelopes.js';
import type { AllocatorState } from './allocators.js';
import type { OutboxRow } from './sqlite-shapes.js';

export interface VersionedStore {
  readVersioned(key: string): Promise<StoredVersioned | null>;
  writeVersioned(key: string, item: VersionedSyncItem): Promise<void>;
}

export interface AllocatorStore {
  read(id: string): Promise<AllocatorState | null>;
  write(id: string, state: AllocatorState): Promise<void>;
}

export interface OutboxStore {
  enqueue(row: OutboxRow): Promise<void>;
  claimDue(now: number, limit: number): Promise<OutboxRow[]>;
  markDelivered(id: string): Promise<void>;
  recordFailure(id: string, error: string, nextAttemptAt: number): Promise<void>;
  deadLetter(id: string, error: string): Promise<void>;
}
