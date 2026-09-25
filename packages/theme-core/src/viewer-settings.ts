import type { ThemeName } from "./themes.js";

/** The settings a viewer's device saves and, while they are signed in, their account holds. */
export interface ViewerSettings {
  theme: ThemeName;
  /** The saved motion preference. `false` never overrides the device's own request for less motion. */
  reducedMotion: boolean;
}

export type ViewerSettingName = keyof ViewerSettings;

/** Each setting's saved value, `null` where nothing is saved. */
export type SavedViewerSettings = { [K in ViewerSettingName]: ViewerSettings[K] | null };

/** A setting saved on both the device and the account, with different values. */
export type ViewerSettingDifference = {
  [K in ViewerSettingName]: { setting: K; device: ViewerSettings[K]; account: ViewerSettings[K] };
}[ViewerSettingName];
