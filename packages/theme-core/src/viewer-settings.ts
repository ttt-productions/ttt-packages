import type { ThemeName } from './themes.js';

export interface ViewerSettings {
  theme: ThemeName;
  reducedMotion: boolean;
}

export type ViewerSettingName = keyof ViewerSettings;

export type SavedViewerSettings = { [K in ViewerSettingName]: ViewerSettings[K] | null };

export type ViewerSettingDifference = {
  [K in ViewerSettingName]: { setting: K; device: ViewerSettings[K]; account: ViewerSettings[K] };
}[ViewerSettingName];
