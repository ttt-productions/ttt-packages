// The failures that leave a page only a reload repairs, recognised narrowly. Server-safe: pure
// predicates over whatever an `error` or `unhandledrejection` event carries.

/** Each failure only a reload repairs. */
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

/**
 * WebKit dropping a page's IndexedDB connection when it reclaims a backgrounded tab: an
 * `UnknownError` whose message says the connection to the Indexed Database server was lost. Every
 * storage call after it fails until the page reloads. No other `UnknownError`, and no quota, blocked
 * storage, or network failure, is this one.
 */
export function isStorageDisconnectError(reason: unknown): boolean {
  return (
    fieldOf(reason, 'name') === STORAGE_DISCONNECT_NAME &&
    (fieldOf(reason, 'message')?.includes(STORAGE_DISCONNECT_MESSAGE) ?? false)
  );
}

/** A code chunk the deployed build no longer serves: a `ChunkLoadError`, or "Failed to load chunk". */
export function isStaleChunkError(reason: unknown): boolean {
  return (
    fieldOf(reason, 'name') === STALE_CHUNK_NAME ||
    (fieldOf(reason, 'message')?.includes(STALE_CHUNK_MESSAGE) ?? false)
  );
}

/** Which failure only a reload repairs `reason` is, or `null` for any other. */
export function reloadRecoveryKindOf(reason: unknown): ReloadRecoveryKind | null {
  if (isStorageDisconnectError(reason)) return 'storageDisconnect';
  if (isStaleChunkError(reason)) return 'staleChunk';
  return null;
}
