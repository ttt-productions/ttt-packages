"use client";

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
} from "react";
import { useTheme } from "next-themes";
import { isThemeName, type ThemeName } from "../themes.js";
import type {
  SavedViewerSettings,
  ViewerSettingDifference,
  ViewerSettingName,
  ViewerSettings,
} from "../viewer-settings.js";
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
} from "../viewer-settings-logic.js";
import { noteStoredValue, readStoredValue, writeStoredValue } from "./local-storage.js";
import type { ReducedMotionStore } from "./reduced-motion-store.js";
import { useThemeStorageKey } from "./theme-provider.js";

/** The account half of the sync, built by the app from its auth state, account read, and settings write. */
export interface ViewerSettingsAccount {
  /**
   * The signed-in account's id, `null` while signed out; signed out, settings live on the device
   * alone. The sync's record of this account (its saves in flight, each setting's baseline, its
   * silent-save attempt) starts over whenever this id changes, a sign-out or sign-in included.
   */
  accountId: string | null;
  /**
   * The account's saved settings, `null` for a setting the account has not saved. `undefined`
   * while the read is loading or failing, never all-`null` in their place: all-`null` means an
   * account with nothing saved, which the sync fills with the device's values. `undefined` pauses
   * the comparison and keeps the sync's record of the account, so a read that fails and recovers
   * picks up where it left off.
   */
  settings: SavedViewerSettings | undefined;
  /** Writes settings to the account; rejects when the write fails. */
  save: (settings: Partial<ViewerSettings>) => Promise<void>;
  /**
   * Receives a failed save the viewer did not start: the device's values saved to an account that
   * has none. It is not retried until the account's values change, `accountId` changes, or the app
   * loads again.
   */
  onSilentSaveError: (error: unknown) => void;
}

export interface ViewerSettingsSyncProviderProps {
  /** The app's reduced-motion store. */
  motion: ReducedMotionStore;
  account: ViewerSettingsAccount;
  /** localStorage key under which this device remembers the differences a viewer dismissed. */
  dismissalStorageKey: string;
  children: ReactNode;
}

/** The non-blocking question asked when the account's saved values differ from the device's. */
export interface ViewerSettingsPrompt {
  /** Every setting whose device and account values differ, except differences already dismissed. */
  differences: ViewerSettingDifference[];
  /** Applies the account's values for these differences to this device. */
  adoptAccountSettings: () => void;
  /** Saves this device's values for these differences to the account; the prompt stays until the account's values reflect them. */
  saveDeviceSettings: () => Promise<void>;
  /** Keeps this device's values; each of these differences is not asked about again while it holds. */
  dismiss: () => void;
}

export interface ViewerSettingsSync {
  /** The theme this device shows; `undefined` on the server and until hydration completes. */
  theme: ThemeName | undefined;
  /** Sets the theme on this device at once and, signed in, on the account; rejects when the account write fails. */
  setTheme: (theme: ThemeName) => Promise<void>;
  /** Sets the saved motion preference on this device at once and, signed in, on the account; rejects when the account write fails. */
  setReducedMotion: (reduced: boolean) => Promise<void>;
  /** The compare prompt, or `null` when there is nothing to ask. */
  prompt: ViewerSettingsPrompt | null;
}

const ViewerSettingsSyncContext = createContext<ViewerSettingsSync | null>(null);

interface StoredValue {
  read: () => string | null;
  write: (value: string | null) => void;
  /** Records a value another library stored, and tells this tab's subscribers. */
  noteWritten: (value: string) => void;
  subscribe: (onChange: () => void) => () => void;
}

// One localStorage entry, observed in this tab through the writes made here and in other tabs
// through the native `storage` event.
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
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
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
    throw new Error("ViewerSettingsSyncProvider must be mounted inside theme-core's ThemeProvider.");
  }
  return key;
}

/**
 * Keeps the viewer's theme and motion settings on the device and, signed in, on the account. Mount
 * it once, inside `ThemeProvider` and below whatever supplies the account adapter.
 */
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
  const deviceMotion = useSyncExternalStore(motion.subscribe, motion.savedReducedMotion, readNothing);
  const storedDismissals = useSyncExternalStore(dismissalStore.subscribe, dismissalStore.read, readNothing);
  const dismissals = useMemo(() => parseDismissals(storedDismissals), [storedDismissals]);

  const { accountId, settings, save, onSilentSaveError } = account;
  const signedIn = accountId !== null;
  const accountTheme = settings?.theme ?? null;
  const accountMotion = settings?.reducedMotion ?? null;
  // Until hydration completes the device reads as the server's "nothing saved", and comparing that
  // would hand the device the account's values over its own.
  const accountReady = hydrated && signedIn && settings !== undefined;

  const device = useMemo<SavedViewerSettings>(
    () => ({ theme: deviceTheme, reducedMotion: deviceMotion }),
    [deviceTheme, deviceMotion],
  );
  const accountValues = useMemo<SavedViewerSettings | null>(
    () => (accountReady ? { theme: accountTheme, reducedMotion: accountMotion } : null),
    [accountReady, accountTheme, accountMotion],
  );

  // The sync's record of the account: each setting's baseline and this tab's saves in flight, with a
  // generation that keys the silent-save attempt. It is adjusted during render, React's pattern for
  // state that follows a changing input, so no comparison runs against a record older than the
  // values it is compared with. A new accountId (sign-out, sign-in, another account) starts it over:
  // a save belongs to the account that made it, and a late settle finds nothing to update. Values
  // going absent (a read loading or failing, or hydration pending) only pause the comparison.
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
        // next-themes re-renders only when the theme it shows changes; noting the write re-reads
        // the stored theme either way, and holds it for the page when storage is blocked.
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

  // One attempt per account state, so a save that keeps failing is reported once instead of looping.
  // The record's generation is part of the state: a new accountId gets its own attempt.
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
  }, [generation, silentTheme, silentMotion, accountTheme, accountMotion, saveTracked, onSilentSaveError]);

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
      adoptAccountSettings: () => writeDevice(viewerSettingsFromDifferences(open, "account")),
      saveDeviceSettings: () => save(viewerSettingsFromDifferences(open, "device")),
      dismiss: () => dismissalStore.write(serializeDismissals([...dismissals, ...open.map(dismissalOf)])),
    };
  }, [differences, dismissals, writeDevice, save, dismissalStore]);

  const theme = hydrated && isThemeName(resolvedTheme) ? resolvedTheme : undefined;
  const value = useMemo<ViewerSettingsSync>(
    () => ({ theme, setTheme, setReducedMotion, prompt }),
    [theme, setTheme, setReducedMotion, prompt],
  );

  return <ViewerSettingsSyncContext.Provider value={value}>{children}</ViewerSettingsSyncContext.Provider>;
}

export function useViewerSettingsSync(): ViewerSettingsSync {
  const sync = useContext(ViewerSettingsSyncContext);
  if (!sync) throw new Error("useViewerSettingsSync must be used within a ViewerSettingsSyncProvider.");
  return sync;
}

/** The enclosing sync, or `null` when none is mounted. */
export function useOptionalViewerSettingsSync(): ViewerSettingsSync | null {
  return useContext(ViewerSettingsSyncContext);
}
