import type { MigrationConsole } from '../doc-schemas/migration-console.js';
import type { MigrationActionId } from './action-ids.js';

export interface MigrationLockHolder {
  readonly actionId: MigrationActionId;
  // Null for a caller holding no run yet, which every live lock blocks.
  readonly operationId: string | null;
}

export function currentLock(state: MigrationConsole, now: number): MigrationConsole['lock'] {
  const lock = state.lock;
  return lock !== null && lock.expiresAt > now ? lock : null;
}

export function lockedByAnother(
  state: MigrationConsole,
  holder: MigrationLockHolder,
  now: number,
): boolean {
  const lock = currentLock(state, now);
  if (lock === null) return false;
  return lock.actionId !== holder.actionId || lock.operationId !== holder.operationId;
}

export function pageInFlight(state: MigrationConsole, now: number): boolean {
  return currentLock(state, now)?.pageClaimedAt !== undefined;
}
