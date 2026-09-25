"use client";

import { useEffect, useSyncExternalStore } from "react";
import { REDUCED_MOTION_ATTRIBUTE } from "../reduced-motion.js";
import { readStoredValue, writeStoredValue } from "./local-storage.js";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface ReducedMotionStoreConfig {
  /** localStorage key for the device's saved preference: `"true"` reduced, `"false"` full, absent when nothing is saved. */
  storageKey: string;
  /** Window event dispatched on every save: the native `storage` event never fires in the tab that wrote. */
  changeEvent: string;
}

/**
 * An app's one effective-motion source. Effective reduced motion is the device's
 * `prefers-reduced-motion` request OR the saved preference, and the device request always wins: a
 * saved "full motion" never turns motion back on while the device asks for less.
 */
export interface ReducedMotionStore {
  /** The device's `prefers-reduced-motion: reduce` request. */
  deviceReducedMotion: () => boolean;
  /** The preference saved on this device; `null` when nothing is saved or storage is blocked. */
  savedReducedMotion: () => boolean | null;
  /** Effective reduced motion, read at call time: the gate for JS-scheduled motion. */
  prefersReducedMotion: () => boolean;
  /**
   * Saves the preference on this device alone (held for the page when storage is blocked), stamps
   * the `<html>` attribute at once, and notifies this tab's subscribers; other tabs follow through
   * the native `storage` event. Under a
   * `ViewerSettingsSyncProvider`, change it through `useViewerSettingsSync` so it also reaches the account.
   */
  setSavedReducedMotion: (reduced: boolean) => void;
  /** Subscribes to every change the store reads: the device request, this tab's saves, other tabs' saves. */
  subscribe: (onChange: () => void) => () => void;
  /** Effective reduced motion, reactive. */
  useReducedMotion: () => boolean;
  /** The device request alone, reactive: what locks a motion control while the device asks for less. */
  useDeviceReducedMotion: () => boolean;
  /** The saved preference alone, reactive; `null` when nothing is saved. */
  useSavedReducedMotion: () => boolean | null;
  /** Mount once in the app shell: keeps the `<html>` attribute in step with effective reduced motion. */
  useApplyReducedMotion: () => void;
}

/** Creates the store once, at module scope, with the app's storage key and change event. */
export function createReducedMotionStore({
  storageKey,
  changeEvent,
}: ReducedMotionStoreConfig): ReducedMotionStore {
  function mediaQueryList(): MediaQueryList | null {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
    return window.matchMedia(REDUCED_MOTION_QUERY);
  }

  function deviceReducedMotion(): boolean {
    return mediaQueryList()?.matches ?? false;
  }

  function savedReducedMotion(): boolean | null {
    const stored = readStoredValue(storageKey);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return null;
  }

  function prefersReducedMotion(): boolean {
    return deviceReducedMotion() || savedReducedMotion() === true;
  }

  function applyAttribute(reduced: boolean): void {
    if (typeof document === "undefined") return;
    if (reduced) document.documentElement.setAttribute(REDUCED_MOTION_ATTRIBUTE, "true");
    else document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
  }

  function setSavedReducedMotion(reduced: boolean): void {
    writeStoredValue(storageKey, String(reduced));
    applyAttribute(prefersReducedMotion());
    window.dispatchEvent(new Event(changeEvent));
  }

  function subscribe(onChange: () => void): () => void {
    const mql = mediaQueryList();
    mql?.addEventListener("change", onChange);
    window.addEventListener(changeEvent, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      mql?.removeEventListener("change", onChange);
      window.removeEventListener(changeEvent, onChange);
      window.removeEventListener("storage", onChange);
    };
  }

  function useReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
  }

  function useDeviceReducedMotion(): boolean {
    return useSyncExternalStore(subscribe, deviceReducedMotion, () => false);
  }

  function useSavedReducedMotion(): boolean | null {
    return useSyncExternalStore(subscribe, savedReducedMotion, () => null);
  }

  function useApplyReducedMotion(): void {
    const reduced = useReducedMotion();
    useEffect(() => {
      applyAttribute(reduced);
    }, [reduced]);
  }

  return {
    deviceReducedMotion,
    savedReducedMotion,
    prefersReducedMotion,
    setSavedReducedMotion,
    subscribe,
    useReducedMotion,
    useDeviceReducedMotion,
    useSavedReducedMotion,
    useApplyReducedMotion,
  };
}
