import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readStoredValue, writeStoredValue, type DeviceStorageArea } from '../src/index';

// Values held for a blocked page live for the module's life, so every test takes its own keys.
let nextKey = 0;
function uniqueKey() {
  nextKey += 1;
  return `device-storage-${nextKey}`;
}

const blocked = () => new DOMException('The operation is insecure.', 'SecurityError');
const AREAS: Array<[DeviceStorageArea, () => Storage]> = [
  ['local', () => window.localStorage],
  ['session', () => window.sessionStorage],
];

describe.each(AREAS)('guarded %s storage', (area, storage) => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads what was written, in its own area only', () => {
    const key = uniqueKey();
    writeStoredValue(key, 'kept', area);
    expect(readStoredValue(key, area)).toBe('kept');
    expect(storage().getItem(key)).toBe('kept');
    const other: DeviceStorageArea = area === 'local' ? 'session' : 'local';
    expect(readStoredValue(key, other)).toBeNull();
  });

  it('removes a value written as null', () => {
    const key = uniqueKey();
    writeStoredValue(key, 'kept', area);
    writeStoredValue(key, null, area);
    expect(readStoredValue(key, area)).toBeNull();
    expect(storage().getItem(key)).toBeNull();
  });

  it('reads nothing saved when storage throws, and never throws itself', () => {
    const key = uniqueKey();
    storage().setItem(key, 'saved before the block');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw blocked();
    });
    expect(readStoredValue(key, area)).toBeNull();
  });

  it('holds a refused write for the page, then lets a later accepted write replace it', () => {
    const key = uniqueKey();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw blocked();
    });
    expect(() => writeStoredValue(key, 'held', area)).not.toThrow();
    expect(readStoredValue(key, area)).toBe('held');

    setItem.mockRestore();
    writeStoredValue(key, 'stored', area);
    expect(readStoredValue(key, area)).toBe('stored');
    expect(storage().getItem(key)).toBe('stored');
  });

  it('holds a refused removal, so the value reads as gone for the page', () => {
    const key = uniqueKey();
    storage().setItem(key, 'saved');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw blocked();
    });
    writeStoredValue(key, null, area);
    expect(readStoredValue(key, area)).toBeNull();
  });
});

describe('when reading the storage area itself throws', () => {
  const own = {
    local: Object.getOwnPropertyDescriptor(window, 'localStorage'),
    session: Object.getOwnPropertyDescriptor(window, 'sessionStorage'),
  };
  beforeEach(() => {
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, {
        configurable: true,
        get() {
          throw blocked();
        },
      });
    }
  });
  afterEach(() => {
    if (own.local) Object.defineProperty(window, 'localStorage', own.local);
    if (own.session) Object.defineProperty(window, 'sessionStorage', own.session);
  });

  it.each(['local', 'session'] as const)('reads nothing, then holds a write for the page (%s)', (area) => {
    const key = uniqueKey();
    expect(readStoredValue(key, area)).toBeNull();
    expect(() => writeStoredValue(key, 'held', area)).not.toThrow();
    expect(readStoredValue(key, area)).toBe('held');
  });
});

describe('the default area', () => {
  it('is localStorage', () => {
    const key = uniqueKey();
    writeStoredValue(key, 'device');
    expect(window.localStorage.getItem(key)).toBe('device');
    expect(readStoredValue(key)).toBe('device');
  });
});
