'use client';

import { useSyncExternalStore } from 'react';
import { readStoredValue, writeStoredValue } from '../device-storage.js';

export interface DevicePreferenceStoreConfig<T> {
  storageKey: string;
  /** Window event dispatched on every save: the native `storage` event never fires in the tab that wrote. */
  changeEvent: string;
  parse: (stored: string) => T | undefined;
  serialize: (value: T) => string;
  fallback: T;
}

export interface DevicePreferenceStore<T> {
  get: () => T;
  set: (value: T) => void;
  clear: () => void;
  subscribe: (onChange: () => void) => () => void;
  useValue: () => T;
}

export function createDevicePreferenceStore<T>({
  storageKey,
  changeEvent,
  parse,
  serialize,
  fallback,
}: DevicePreferenceStoreConfig<T>): DevicePreferenceStore<T> {
  // useSyncExternalStore needs a stable snapshot: the same saved string always yields the same value.
  let lastStored: string | null = null;
  let lastValue: T = fallback;

  function get(): T {
    const stored = readStoredValue(storageKey);
    if (stored === lastStored) return lastValue;
    lastStored = stored;
    if (stored === null) {
      lastValue = fallback;
    } else {
      const parsed = parse(stored);
      lastValue = parsed === undefined ? fallback : parsed;
    }
    return lastValue;
  }

  function save(stored: string | null): void {
    writeStoredValue(storageKey, stored);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(changeEvent));
  }

  function subscribe(onChange: () => void): () => void {
    window.addEventListener(changeEvent, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(changeEvent, onChange);
      window.removeEventListener('storage', onChange);
    };
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, get, () => fallback);
  }

  return {
    get,
    set: (value) => save(serialize(value)),
    clear: () => save(null),
    subscribe,
    useValue,
  };
}
