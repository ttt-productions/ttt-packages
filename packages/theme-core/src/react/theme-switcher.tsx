"use client";

import * as React from "react";
import { useTheme } from "next-themes";

export interface ThemeOption {
  /** Theme value passed to next-themes' setTheme. */
  value: string;
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
  /** Render prop for the menu container. */
  renderMenu: (args: { children: React.ReactNode }) => React.ReactNode;
  /** Render prop for each menu item. */
  renderItem: (args: {
    option: ThemeOption;
    isActive: boolean;
    onSelect: () => void;
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
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const active = themes.find((t) => t.value === theme);
  const activeIcon = active?.icon ?? null;

  const trigger = renderTrigger({ activeIcon, srLabel, disabled: !mounted });

  if (!mounted) return <>{trigger}</>;

  return (
    <>
      {renderMenu({
        children: themes.map((option) =>
          renderItem({
            option,
            isActive: option.value === theme,
            onSelect: () => setTheme(option.value),
          }),
        ),
      })}
    </>
  );
}
