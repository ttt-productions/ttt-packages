'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useTheme } from 'next-themes';
import { isThemeName, type ThemeName } from '../themes.js';
import type {
  SavedViewerSettings,
  ViewerSettingDifference,
  ViewerSettingName,
  ViewerSettings,
} from '../viewer-settings.js';
import {
  advanceBaseline,
  beginSave,
  changedAccountSettings,
  compareViewerSettings,
  dismissalOf,
  holdingDismissals,
  isDismissed,
  parseDismissals,
  releaseLandedSaves,
  savingSettings,
  serializeDismissals,
  settleSave,
  viewerSettingsFromDifferences,
  type Baseline,
  type SaveTracks,
} from '../viewer-settings-logic.js';
import { noteStoredValue, readStoredValue, writeStoredValue } from '../device-storage.js';
import type { ReducedMotionStore } from './reduced-motion-store.js';
import { useThemeStorageKey } from './theme-provider.js';

export interface ViewerSettingsAccount {
  accountId: string | null;
  settings: SavedViewerSettings | undefined;
  save: (settings: Partial<ViewerSettings>) => Promise<void>;
  onSilentSaveError: (error: unknown) => void;
}

export interface ViewerSettingsSyncProviderProps {
  motion: ReducedMotionStore;
  account: ViewerSettingsAccount;
  dismissalStorageKey: string;
  children: ReactNode;
}

export interface ViewerSettingsPrompt {
  differences: ViewerSettingDifference[];
  adoptAccountSettings: () => void;
  saveDeviceSettings: () => Promise<void>;
  dismiss: () => void;
}

export interface ViewerSettingsSync {
  theme: ThemeName | undefined;
  setTheme: (theme: ThemeName) => Promise<void>;
  setReducedMotion: (reduced: boolean) => Promise<void>;
  prompt: ViewerSettingsPrompt | null;
}

const ViewerSettingsSyncContext = createContext<ViewerSettingsSync | null>(null);

interface StoredValue {
  read: () => string | null;
  write: (value: string | null) => void;
  noteWritten: (value: string) => void;
  subscribe: (onChange: () => void) => () => void;
}

function storedValue(key: string): StoredValue {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    read: () => readStoredValue(key),
    write: (value) => {
      writeStoredValue(key, value);
      notify();
    },
    noteWritten: (value) => {
      noteStoredValue(key, value);
      notify();
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      window.addEventListener('storage', onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener('storage', onChange);
      };
    },
  };
}

const readNothing = () => null;
const subscribeNothing = () => () => {};
const snapshotTrue = () => true;
const snapshotFalse = () => false;
const NO_SETTINGS: ReadonlySet<ViewerSettingName> = new Set();

function useRequiredThemeStorageKey(): string {
  const key = useThemeStorageKey();
  if (key === null) {
    throw new Error(
      "ViewerSettingsSyncProvider must be mounted inside theme-core's ThemeProvider.",
    );
  }
  return key;
}

export function ViewerSettingsSyncProvider({
  motion,
  account,
  dismissalStorageKey,
  children,
}: ViewerSettingsSyncProviderProps) {
  const themeStorageKey = useRequiredThemeStorageKey();
  const { resolvedTheme, setTheme: setDeviceTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribeNothing, snapshotTrue, snapshotFalse);

  const themeStore = useMemo(() => storedValue(themeStorageKey), [themeStorageKey]);
  const dismissalStore = useMemo(() => storedValue(dismissalStorageKey), [dismissalStorageKey]);

  const storedTheme = useSyncExternalStore(themeStore.subscribe, themeStore.read, readNothing);
  const deviceTheme = isThemeName(storedTheme) ? storedTheme : null;
  const deviceMotion = useSyncExternalStore(
    motion.subscribe,
    motion.savedReducedMotion,
    readNothing,
  );
  const storedDismissals = useSyncExternalStore(
    dismissalStore.subscribe,
    dismissalStore.read,
    readNothing,
  );
  const dismissals = useMemo(() => parseDismissals(storedDismissals), [storedDismissals]);

  const { accountId, settings, save, onSilentSaveError } = account;
  const signedIn = accountId !== null;
  const accountTheme = settings?.theme ?? null;
  const accountMotion = settings?.reducedMotion ?? null;
  // Until hydration completes the device reads as the server's "nothing saved"; comparing that would
  // hand the device the account's values over its own.
  const accountReady = hydrated && signedIn && settings !== undefined;

  const device = useMemo<SavedViewerSettings>(
    () => ({ theme: deviceTheme, reducedMotion: deviceMotion }),
    [deviceTheme, deviceMotion],
  );
  const accountValues = useMemo<SavedViewerSettings | null>(
    () => (accountReady ? { theme: accountTheme, reducedMotion: accountMotion } : null),
    [accountReady, accountTheme, accountMotion],
  );

  const [owner, setOwner] = useState(() => ({ accountId, generation: 0 }));
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [saves, setSaves] = useState<SaveTracks>({});
  let currentBaseline: Baseline | null = null;
  if (owner.accountId !== accountId) {
    setOwner({ accountId, generation: owner.generation + 1 });
    setBaseline(null);
    setSaves({});
  } else if (accountValues !== null) {
    const nextBaseline = advanceBaseline(baseline, accountValues, device);
    if (nextBaseline === baseline) {
      currentBaseline = baseline;
    } else {
      setBaseline(nextBaseline);
      const changed = changedAccountSettings(baseline, accountValues);
      setSaves((current) => releaseLandedSaves(current, changed));
    }
  }

  const saving = useMemo(
    () => (accountValues === null ? NO_SETTINGS : savingSettings(saves, accountValues)),
    [saves, accountValues],
  );
  const comparison = useMemo(
    () =>
      currentBaseline && accountValues
        ? compareViewerSettings({
            device,
            account: accountValues,
            deviceAtAccountChange: currentBaseline.device,
            saving,
          })
        : null,
    [currentBaseline, accountValues, device, saving],
  );

  const writeDevice = useCallback(
    (values: Partial<ViewerSettings>) => {
      if (values.theme !== undefined) {
        setDeviceTheme(values.theme);
        // next-themes re-renders only when the theme it shows changes, so the write is noted either way.
        themeStore.noteWritten(values.theme);
      }
      if (values.reducedMotion !== undefined) motion.setSavedReducedMotion(values.reducedMotion);
    },
    [setDeviceTheme, themeStore, motion],
  );

  const saveIds = useRef(0);
  const saveTracked = useCallback(
    async (values: Partial<ViewerSettings>) => {
      saveIds.current += 1;
      const id = saveIds.current;
      setSaves((current) => beginSave(current, values, id));
      try {
        await save(values);
      } catch (error) {
        setSaves((current) => settleSave(current, values, id, false));
        throw error;
      }
      setSaves((current) => settleSave(current, values, id, true));
    },
    [save],
  );

  const change = useCallback(
    async (values: Partial<ViewerSettings>) => {
      writeDevice(values);
      if (signedIn) await saveTracked(values);
    },
    [writeDevice, signedIn, saveTracked],
  );
  const setTheme = useCallback((theme: ThemeName) => change({ theme }), [change]);
  const setReducedMotion = useCallback(
    (reducedMotion: boolean) => change({ reducedMotion }),
    [change],
  );

  const adoptTheme = comparison?.adoptFromAccount.theme;
  const adoptMotion = comparison?.adoptFromAccount.reducedMotion;
  useEffect(() => {
    if (adoptTheme !== undefined || adoptMotion !== undefined) {
      writeDevice({ theme: adoptTheme, reducedMotion: adoptMotion });
    }
  }, [adoptTheme, adoptMotion, writeDevice]);

  const attemptedSilentSave = useRef<string | null>(null);
  const generation = owner.generation;
  const silentTheme = comparison?.saveToAccount.theme;
  const silentMotion = comparison?.saveToAccount.reducedMotion;
  useEffect(() => {
    if (silentTheme === undefined && silentMotion === undefined) return;
    const attempt = JSON.stringify([
      generation,
      accountTheme,
      accountMotion,
      silentTheme ?? null,
      silentMotion ?? null,
    ]);
    if (attemptedSilentSave.current === attempt) return;
    attemptedSilentSave.current = attempt;
    const values: Partial<ViewerSettings> = {};
    if (silentTheme !== undefined) values.theme = silentTheme;
    if (silentMotion !== undefined) values.reducedMotion = silentMotion;
    void (async () => {
      try {
        await saveTracked(values);
      } catch (error) {
        onSilentSaveError(error);
      }
    })();
  }, [
    generation,
    silentTheme,
    silentMotion,
    accountTheme,
    accountMotion,
    saveTracked,
    onSilentSaveError,
  ]);

  useEffect(() => {
    if (accountValues === null) return;
    const holding = holdingDismissals(dismissals, device, accountValues);
    if (holding.length !== dismissals.length) dismissalStore.write(serializeDismissals(holding));
  }, [accountValues, device, dismissals, dismissalStore]);

  const differences = comparison?.differences;
  const prompt = useMemo<ViewerSettingsPrompt | null>(() => {
    const open = differences?.filter((difference) => !isDismissed(difference, dismissals)) ?? [];
    if (open.length === 0) return null;
    return {
      differences: open,
      adoptAccountSettings: () => writeDevice(viewerSettingsFromDifferences(open, 'account')),
      saveDeviceSettings: () => save(viewerSettingsFromDifferences(open, 'device')),
      dismiss: () =>
        dismissalStore.write(serializeDismissals([...dismissals, ...open.map(dismissalOf)])),
    };
  }, [differences, dismissals, writeDevice, save, dismissalStore]);

  const theme = hydrated && isThemeName(resolvedTheme) ? resolvedTheme : undefined;
  const value = useMemo<ViewerSettingsSync>(
    () => ({ theme, setTheme, setReducedMotion, prompt }),
    [theme, setTheme, setReducedMotion, prompt],
  );

  return (
    <ViewerSettingsSyncContext.Provider value={value}>
      {children}
    </ViewerSettingsSyncContext.Provider>
  );
}

export function useViewerSettingsSync(): ViewerSettingsSync {
  const sync = useContext(ViewerSettingsSyncContext);
  if (!sync)
    throw new Error('useViewerSettingsSync must be used within a ViewerSettingsSyncProvider.');
  return sync;
}

export function useOptionalViewerSettingsSync(): ViewerSettingsSync | null {
  return useContext(ViewerSettingsSyncContext);
}
