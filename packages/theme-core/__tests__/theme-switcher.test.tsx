import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { ThemeSwitcher, type ThemeOption } from '../src/react/theme-switcher';

const mockSetTheme = vi.fn();
const mockUseTheme = vi.hoisted(() => vi.fn());

vi.mock('next-themes', () => ({
  useTheme: mockUseTheme,
}));

const themes: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: <span>☀️</span> },
  { value: 'dark', label: 'Dark', icon: <span>🌙</span> },
  { value: 'high-contrast', label: 'High Contrast' },
];

function makeProps() {
  return {
    themes,
    renderTrigger: ({ srLabel, disabled }: { activeIcon: React.ReactNode; srLabel: string; disabled: boolean }) => (
      <button disabled={disabled} aria-label={srLabel}>toggle</button>
    ),
    renderMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
    renderItem: ({ option, isActive, onSelect }: { option: ThemeOption; isActive: boolean; onSelect: () => void }) => (
      <li key={option.value}>
        <button
          onClick={onSelect}
          data-active={isActive ? 'true' : 'false'}
        >
          {option.label}
        </button>
      </li>
    ),
  };
}

beforeEach(() => {
  mockSetTheme.mockClear();
  mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme });
});

describe('ThemeSwitcher', () => {
  it('calls renderTrigger with the srLabel and a disabled flag', () => {
    const renderTrigger = vi.fn(({ srLabel, disabled }: { activeIcon: React.ReactNode; srLabel: string; disabled: boolean }) => (
      <button disabled={disabled} aria-label={srLabel}>toggle</button>
    ));
    render(<ThemeSwitcher {...makeProps()} renderTrigger={renderTrigger} />);
    // renderTrigger is called at least once (pre-mount with disabled=true)
    expect(renderTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ srLabel: 'Toggle theme' }),
    );
  });

  it('renders menu items after mount', () => {
    render(<ThemeSwitcher {...makeProps()} />);
    // After mount (useEffect fires in jsdom), menu items appear
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('High Contrast')).toBeInTheDocument();
  });

  it('calls setTheme when an item is clicked', () => {
    render(<ThemeSwitcher {...makeProps()} />);
    fireEvent.click(screen.getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('marks the active theme item', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: mockSetTheme });
    render(<ThemeSwitcher {...makeProps()} />);
    const darkBtn = screen.getByText('Dark').closest('button');
    expect(darkBtn).toHaveAttribute('data-active', 'true');
    const lightBtn = screen.getByText('Light').closest('button');
    expect(lightBtn).toHaveAttribute('data-active', 'false');
  });

  it('passes custom srLabel to renderTrigger', () => {
    const renderTrigger = vi.fn(({ srLabel }: { activeIcon: React.ReactNode; srLabel: string; disabled: boolean }) => (
      <button aria-label={srLabel}>toggle</button>
    ));
    render(<ThemeSwitcher {...makeProps()} renderTrigger={renderTrigger} srLabel="Pick a theme" />);
    expect(renderTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ srLabel: 'Pick a theme' }),
    );
  });
});
