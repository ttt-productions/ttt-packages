import { describe, it, expect } from 'vitest';
import {
  isStaleChunkError,
  isStorageDisconnectError,
  reloadRecoveryKindOf,
} from '../src/lib/reload-recovery.js';

const DISCONNECT_MESSAGE =
  'Connection to Indexed Database server lost. Refresh the page to try again';

describe('isStorageDisconnectError', () => {
  it('recognises the lost IndexedDB connection, as a DOMException and as a plain object', () => {
    expect(isStorageDisconnectError(new DOMException(DISCONNECT_MESSAGE, 'UnknownError'))).toBe(
      true,
    );
    expect(isStorageDisconnectError({ name: 'UnknownError', message: DISCONNECT_MESSAGE })).toBe(
      true,
    );
  });

  it('refuses any other UnknownError, the same words under another name, and other storage failures', () => {
    expect(
      isStorageDisconnectError(
        new DOMException('Internal error opening backing store', 'UnknownError'),
      ),
    ).toBe(false);
    expect(isStorageDisconnectError(new Error(DISCONNECT_MESSAGE))).toBe(false);
    expect(
      isStorageDisconnectError(
        new DOMException('The quota has been exceeded.', 'QuotaExceededError'),
      ),
    ).toBe(false);
    expect(
      isStorageDisconnectError(new DOMException('The operation is insecure.', 'SecurityError')),
    ).toBe(false);
    expect(isStorageDisconnectError(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('refuses a value that is not an error', () => {
    for (const reason of [null, undefined, DISCONNECT_MESSAGE, 42])
      expect(isStorageDisconnectError(reason)).toBe(false);
  });
});

describe('isStaleChunkError', () => {
  it('recognises a ChunkLoadError and a failure to load a chunk', () => {
    expect(
      isStaleChunkError(
        Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' }),
      ),
    ).toBe(true);
    expect(isStaleChunkError(new Error('Failed to load chunk /_next/static/chunks/app.js'))).toBe(
      true,
    );
  });

  it('refuses any other failure', () => {
    expect(isStaleChunkError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isStaleChunkError(new DOMException(DISCONNECT_MESSAGE, 'UnknownError'))).toBe(false);
    expect(isStaleChunkError('Failed to load chunk')).toBe(false);
  });
});

describe('reloadRecoveryKindOf', () => {
  it('names each failure, and nothing for any other', () => {
    expect(reloadRecoveryKindOf(new DOMException(DISCONNECT_MESSAGE, 'UnknownError'))).toBe(
      'storageDisconnect',
    );
    expect(reloadRecoveryKindOf(new Error('Failed to load chunk 7'))).toBe('staleChunk');
    expect(reloadRecoveryKindOf(new Error('boom'))).toBeNull();
  });
});
