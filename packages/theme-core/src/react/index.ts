"use client";

export { ThemeProvider } from "./theme-provider.js";
export { ThemeSwitcher } from "./theme-switcher.js";
export type { ThemeSwitcherProps, ThemeOption } from "./theme-switcher.js";
export { createReducedMotionStore } from "./reduced-motion-store.js";
export type { ReducedMotionStore, ReducedMotionStoreConfig } from "./reduced-motion-store.js";
export { ViewerSettingsSyncProvider, useViewerSettingsSync } from "./viewer-settings-sync.js";
export type {
  ViewerSettingsAccount,
  ViewerSettingsPrompt,
  ViewerSettingsSync,
  ViewerSettingsSyncProviderProps,
} from "./viewer-settings-sync.js";
