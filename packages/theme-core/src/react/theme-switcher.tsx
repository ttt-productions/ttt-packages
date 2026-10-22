'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import type { ThemeName } from '../themes.js';
import { useOptionalViewerSettingsSync } from './viewer-settings-sync.js';

export interface ThemeOption {
  value: ThemeName;
  label: string;
  icon?: React.ReactNode;
}

export interface ThemeSwitcherProps {
  themes: ThemeOption[];
  renderTrigger: (args: {
    activeIcon: React.ReactNode;
    srLabel: string;
    disabled: boolean;
  }) => React.ReactNode;
  renderMenu: (args: { trigger: React.ReactNode; children: React.ReactNode }) => React.ReactNode;
  renderItem: (args: {
    option: ThemeOption;
    isActive: boolean;
    onSelect: () => Promise<void>;
  }) => React.ReactNode;
  srLabel?: string;
}

export function ThemeSwitcher({
  themes,
  renderTrigger,
  renderMenu,
  renderItem,
  srLabel = 'Toggle theme',
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
