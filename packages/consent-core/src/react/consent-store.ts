'use client';

import { createDevicePreferenceStore } from '@ttt-productions/theme-core/react';
import { parseStoredConsent, type ConsentState } from '../consent-state.js';

export interface ConsentStoreConfig {
  storageKey: string;
  changeEvent: string;
}

export interface ConsentStore {
  get: () => ConsentState;
  set: (state: ConsentState) => void;
  subscribe: (onChange: () => void) => () => void;
}

export function createConsentStore({ storageKey, changeEvent }: ConsentStoreConfig): ConsentStore {
  const stored = createDevicePreferenceStore<ConsentState>({
    storageKey,
    changeEvent,
    parse: parseStoredConsent,
    serialize: String,
    fallback: 'unset',
  });
  return {
    get: stored.get,
    set: (state) => (state === 'unset' ? stored.clear() : stored.set(state)),
    subscribe: stored.subscribe,
  };
}
