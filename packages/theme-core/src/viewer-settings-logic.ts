// The account sync's pure steps, server-safe so they are tested without React. Internal to the
// package: the root does not export them, because apps use ViewerSettingsSyncProvider, not its steps.

import type {
  SavedViewerSettings,
  ViewerSettingDifference,
  ViewerSettingName,
  ViewerSettings,
} from "./viewer-settings.js";

// A record, so adding a setting to ViewerSettings fails to compile until it is listed here; its key
// order is the order every per-setting walk takes.
const SETTING_ORDER: Record<ViewerSettingName, true> = { theme: true, reducedMotion: true };
const SETTING_NAMES = Object.keys(SETTING_ORDER) as ViewerSettingName[];

type SettingValue = ViewerSettings[ViewerSettingName];

function assign<K extends ViewerSettingName>(
  target: Partial<ViewerSettings>,
  setting: K,
  value: ViewerSettings[K],
): void {
  target[setting] = value;
}

function copySaved<K extends ViewerSettingName>(
  target: SavedViewerSettings,
  source: SavedViewerSettings,
  setting: K,
): void {
  target[setting] = source[setting];
}

// Baseline: per setting, the account's value and the device's value when that account value arrived.

export interface Baseline {
  account: SavedViewerSettings;
  device: SavedViewerSettings;
}

/** The settings whose account value is not the baseline's: every setting when there is no baseline. */
export function changedAccountSettings(
  baseline: Baseline | null,
  account: SavedViewerSettings,
): ViewerSettingName[] {
  return SETTING_NAMES.filter((setting) => baseline === null || baseline.account[setting] !== account[setting]);
}

/**
 * Moves each setting whose account value changed to the current account and device values; every
 * other setting keeps its baseline. Returns `baseline` itself when nothing moved.
 */
export function advanceBaseline(
  baseline: Baseline | null,
  account: SavedViewerSettings,
  device: SavedViewerSettings,
): Baseline {
  const changed = changedAccountSettings(baseline, account);
  if (baseline !== null && changed.length === 0) return baseline;
  const next: Baseline = {
    account: { ...(baseline?.account ?? account) },
    device: { ...(baseline?.device ?? device) },
  };
  for (const setting of changed) {
    copySaved(next.account, account, setting);
    copySaved(next.device, device, setting);
  }
  return next;
}

// Saves from this tab, per setting: pending until they settle; once landed, held until the account
// shows the saved value or that setting's account value changes.

export interface SaveTrack {
  id: number;
  value: SettingValue;
  landed: boolean;
}

export type SaveTracks = Partial<Record<ViewerSettingName, SaveTrack>>;

export function beginSave(tracks: SaveTracks, values: Partial<ViewerSettings>, id: number): SaveTracks {
  const next = { ...tracks };
  for (const setting of SETTING_NAMES) {
    const value = values[setting];
    if (value !== undefined) next[setting] = { id, value, landed: false };
  }
  return next;
}

/** Marks save `id` landed, or drops it when it failed; a later save of the same setting is left alone. */
export function settleSave(
  tracks: SaveTracks,
  values: Partial<ViewerSettings>,
  id: number,
  landed: boolean,
): SaveTracks {
  let next = tracks;
  for (const setting of SETTING_NAMES) {
    const track = tracks[setting];
    if (values[setting] === undefined || track?.id !== id) continue;
    if (next === tracks) next = { ...tracks };
    if (landed) next[setting] = { ...track, landed: true };
    else delete next[setting];
  }
  return next;
}

/** Drops the landed saves of the given settings: their account value has since changed. */
export function releaseLandedSaves(tracks: SaveTracks, settings: readonly ViewerSettingName[]): SaveTracks {
  let next = tracks;
  for (const setting of settings) {
    if (!tracks[setting]?.landed) continue;
    if (next === tracks) next = { ...tracks };
    delete next[setting];
  }
  return next;
}

/** The settings a save from this tab still answers for: pending, or landed but not yet in the account. */
export function savingSettings(tracks: SaveTracks, account: SavedViewerSettings): Set<ViewerSettingName> {
  return new Set(
    SETTING_NAMES.filter((setting) => {
      const track = tracks[setting];
      return track !== undefined && (!track.landed || account[setting] !== track.value);
    }),
  );
}

export interface ViewerSettingsSides {
  device: SavedViewerSettings;
  account: SavedViewerSettings;
  /** Per setting, the device's value when that setting's account value last changed. */
  deviceAtAccountChange: SavedViewerSettings;
  /** Settings a save from this tab still answers for. */
  saving: ReadonlySet<ViewerSettingName>;
}

export interface ViewerSettingsComparison {
  /** Settings the device has nothing saved for: it takes the account's values without asking. */
  adoptFromAccount: Partial<ViewerSettings>;
  /** Settings the account has nothing saved for: the device's values are saved to it without asking. */
  saveToAccount: Partial<ViewerSettings>;
  /** Settings saved on both sides with different values. */
  differences: ViewerSettingDifference[];
}

export function compareViewerSettings({
  device,
  account,
  deviceAtAccountChange,
  saving,
}: ViewerSettingsSides): ViewerSettingsComparison {
  const adoptFromAccount: Partial<ViewerSettings> = {};
  const saveToAccount: Partial<ViewerSettings> = {};
  const differences: ViewerSettingDifference[] = [];

  for (const setting of SETTING_NAMES) {
    // A setting this tab is saving, or one changed on this device (by any tab) since its account
    // value arrived, is on its way to the account: comparing it now would ask about the viewer's
    // own change.
    if (saving.has(setting) || device[setting] !== deviceAtAccountChange[setting]) continue;

    const onDevice = device[setting];
    const onAccount = account[setting];
    if (onDevice === null) {
      if (onAccount !== null) assign(adoptFromAccount, setting, onAccount);
    } else if (onAccount === null) {
      assign(saveToAccount, setting, onDevice);
    } else if (onDevice !== onAccount) {
      differences.push({ setting, device: onDevice, account: onAccount } as ViewerSettingDifference);
    }
  }

  return { adoptFromAccount, saveToAccount, differences };
}

/** One side's values for the given differences. */
export function viewerSettingsFromDifferences(
  differences: readonly ViewerSettingDifference[],
  side: "device" | "account",
): Partial<ViewerSettings> {
  const values: Partial<ViewerSettings> = {};
  for (const difference of differences) assign(values, difference.setting, difference[side]);
  return values;
}

// Dismissals: each dismissed difference is remembered on its own, as [setting, device, account].

export type Dismissal = readonly [setting: ViewerSettingName, device: SettingValue, account: SettingValue];

function isDismissal(value: unknown): value is Dismissal {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    (SETTING_NAMES as readonly unknown[]).includes(value[0])
  );
}

/** The dismissals stored on the device; anything unreadable counts as none. */
export function parseDismissals(stored: string | null): Dismissal[] {
  if (stored === null) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isDismissal) : [];
  } catch {
    return [];
  }
}

/** The stored form of `dismissals`; `null` (remove the entry) when there are none. */
export function serializeDismissals(dismissals: readonly Dismissal[]): string | null {
  return dismissals.length === 0 ? null : JSON.stringify(dismissals);
}

export function dismissalOf(difference: ViewerSettingDifference): Dismissal {
  return [difference.setting, difference.device, difference.account];
}

export function isDismissed(difference: ViewerSettingDifference, dismissals: readonly Dismissal[]): boolean {
  return dismissals.some(
    ([setting, device, account]) =>
      setting === difference.setting && device === difference.device && account === difference.account,
  );
}

/** The dismissals that still hold: the device and the account still carry exactly the dismissed values. */
export function holdingDismissals(
  dismissals: readonly Dismissal[],
  device: SavedViewerSettings,
  account: SavedViewerSettings,
): Dismissal[] {
  return dismissals.filter(
    ([setting, onDevice, onAccount]) => device[setting] === onDevice && account[setting] === onAccount,
  );
}
