'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { REDUCED_MOTION_ATTRIBUTE } from '../reduced-motion.js';
import { createDevicePreferenceStore } from './device-preference-store.js';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface ReducedMotionStoreConfig {
  storageKey: string;
  /** Window event dispatched on every save: the native `storage` event never fires in the tab that wrote. */
  changeEvent: string;
}

export interface ReducedMotionStore {
  deviceReducedMotion: () => boolean;
  savedReducedMotion: () => boolean | null;
  prefersReducedMotion: () => boolean;
  setSavedReducedMotion: (reduced: boolean) => void;
  subscribe: (onChange: () => void) => () => void;
  useReducedMotion: () => boolean;
  useDeviceReducedMotion: () => boolean;
  useSavedReducedMotion: () => boolean | null;
  useApplyReducedMotion: () => void;
}

export function createReducedMotionStore({
  storageKey,
  changeEvent,
}: ReducedMotionStoreConfig): ReducedMotionStore {
  function mediaQueryList(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
    return window.matchMedia(REDUCED_MOTION_QUERY);
  }

  function deviceReducedMotion(): boolean {
    return mediaQueryList()?.matches ?? false;
  }

  const saved = createDevicePreferenceStore<boolean | null>({
    storageKey,
    changeEvent,
    parse: (stored) => (stored === 'true' ? true : stored === 'false' ? false : undefined),
    serialize: String,
    fallback: null,
  });

  function savedReducedMotion(): boolean | null {
    return saved.get();
  }

  function prefersReducedMotion(): boolean {
    return deviceReducedMotion() || savedReducedMotion() === true;
  }

  function applyAttribute(reduced: boolean): void {
    if (typeof document === 'undefined') return;
    if (reduced) document.documentElement.setAttribute(REDUCED_MOTION_ATTRIBUTE, 'true');
    else document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
  }

  function setSavedReducedMotion(reduced: boolean): void {
    applyAttribute(deviceReducedMotion() || reduced);
    saved.set(reduced);
  }

  function subscribe(onChange: () => void): () => void {
    const mql = mediaQueryList();
    mql?.addEventListener('change', onChange);
    const unsubscribeSaved = saved.subscribe(onChange);
    return () => {
      mql?.removeEventListener('change', onChange);
      unsubscribeSaved();
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
