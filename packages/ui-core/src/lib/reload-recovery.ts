export const RELOAD_RECOVERY_KINDS = ['storageDisconnect', 'staleChunk'] as const;
export type ReloadRecoveryKind = (typeof RELOAD_RECOVERY_KINDS)[number];

const STORAGE_DISCONNECT_NAME = 'UnknownError';
const STORAGE_DISCONNECT_MESSAGE = 'Connection to Indexed Database server lost';
const STALE_CHUNK_NAME = 'ChunkLoadError';
const STALE_CHUNK_MESSAGE = 'Failed to load chunk';

function fieldOf(reason: unknown, field: 'name' | 'message'): string | null {
  if (typeof reason !== 'object' || reason === null) return null;
  const value = (reason as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
}

/** WebKit drops a backgrounded tab's IndexedDB connection; every storage call after it fails until the page reloads. */
export function isStorageDisconnectError(reason: unknown): boolean {
  return (
    fieldOf(reason, 'name') === STORAGE_DISCONNECT_NAME &&
    (fieldOf(reason, 'message')?.includes(STORAGE_DISCONNECT_MESSAGE) ?? false)
  );
}

export function isStaleChunkError(reason: unknown): boolean {
  return (
    fieldOf(reason, 'name') === STALE_CHUNK_NAME ||
    (fieldOf(reason, 'message')?.includes(STALE_CHUNK_MESSAGE) ?? false)
  );
}

export function reloadRecoveryKindOf(reason: unknown): ReloadRecoveryKind | null {
  if (isStorageDisconnectError(reason)) return 'storageDisconnect';
  if (isStaleChunkError(reason)) return 'staleChunk';
  return null;
}
