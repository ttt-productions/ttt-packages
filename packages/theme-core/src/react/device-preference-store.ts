"use client";

import { useSyncExternalStore } from "react";
import { readStoredValue, writeStoredValue } from "../device-storage.js";

export interface DevicePreferenceStoreConfig<T> {
  /** localStorage key the preference is saved under. */
  storageKey: string;
  /** Window event dispatched on every save: the native `storage` event never fires in the tab that wrote. */
  changeEvent: string;
  /**
   * Reads a saved string. Returns `undefined` for a value it does not recognise, which reads as
   * `fallback`, so a stale or hand-edited entry never reaches the app.
   */
  parse: (stored: string) => T | undefined;
  /** The string a value is saved as. */
  serialize: (value: T) => string;
  /** The value while nothing is saved, the saved string is unrecognised, storage is blocked, or on the server. */
  fallback: T;
}

/** One device-local preference, kept consistent across this tab and every other open tab. */
export interface DevicePreferenceStore<T> {
  /** The current value, read at call time. */
  get: () => T;
  /** Saves `value` on this device (held for the page when storage is blocked) and notifies every reader. */
  set: (value: T) => void;
  /** Removes the saved value, so the store reads `fallback`, and notifies every reader. */
  clear: () => void;
  /** Subscribes to this tab's saves and to other tabs' saves (the native `storage` event). */
  subscribe: (onChange: () => void) => () => void;
  /** The current value, reactive; `fallback` during server render and hydration. */
  useValue: () => T;
}

/** Creates the store once, at module scope, with the app's storage key, change event, and codec. */
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
    if (typeof window !== "undefined") window.dispatchEvent(new Event(changeEvent));
  }

  function subscribe(onChange: () => void): () => void {
    window.addEventListener(changeEvent, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(changeEvent, onChange);
      window.removeEventListener("storage", onChange);
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
