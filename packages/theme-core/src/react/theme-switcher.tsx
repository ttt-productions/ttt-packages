"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import type { ThemeName } from "../themes.js";
import { useOptionalViewerSettingsSync } from "./viewer-settings-sync.js";

export interface ThemeOption {
  /** The theme this option selects. */
  value: ThemeName;
  /** Human-readable label rendered in the menu. */
  label: string;
  /** Icon rendered next to the label and in the trigger when this theme is active. */
  icon?: React.ReactNode;
}

export interface ThemeSwitcherProps {
  /** Ordered list of selectable themes. */
  themes: ThemeOption[];
  /** Render prop for the trigger button. Receives the icon for the active theme. */
  renderTrigger: (args: {
    activeIcon: React.ReactNode;
    srLabel: string;
    disabled: boolean;
  }) => React.ReactNode;
  /** Render prop for the menu container. Receives both the trigger node and the rendered items. */
  renderMenu: (args: { trigger: React.ReactNode; children: React.ReactNode }) => React.ReactNode;
  /**
   * Render prop for each menu item. `onSelect` switches the device's theme at once; under a
   * `ViewerSettingsSyncProvider` it goes through the sync, so a signed-in viewer's account is
   * saved too and the promise rejects when that save fails.
   */
  renderItem: (args: {
    option: ThemeOption;
    isActive: boolean;
    onSelect: () => Promise<void>;
  }) => React.ReactNode;
  /** Accessible label for the trigger. Defaults to "Toggle theme". */
  srLabel?: string;
}

/**
 * Headless, fully-render-prop-driven theme switcher.
 * theme-core owns the next-themes integration and the "available themes" data shape.
 * Consumers own all visual styling — wrap their own DropdownMenu / Button / Icon set.
 */
export function ThemeSwitcher({
  themes,
  renderTrigger,
  renderMenu,
  renderItem,
  srLabel = "Toggle theme",
}: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const sync = useOptionalViewerSettingsSync();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const select = (value: ThemeName): Promise<void> => {
    if (sync) return sync.setTheme(value);
    setTheme(value);
    return Promise.resolve();
  };

  const active = themes.find((t) => t.value === theme);
  const activeIcon = active?.icon ?? null;

  const trigger = renderTrigger({ activeIcon, srLabel, disabled: !mounted });

  if (!mounted) return <>{trigger}</>;

  return (
    <>
      {renderMenu({
        trigger,
        children: themes.map((option) =>
          renderItem({
            option,
            isActive: option.value === theme,
            onSelect: () => select(option.value),
          }),
        ),
      })}
    </>
  );
}
