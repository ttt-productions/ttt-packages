import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as React from 'react';
import { ThemeSwitcher, type ThemeOption } from '../src/react/theme-switcher.js';
import { anything } from '../../../test/matchers.js';

const mockSetTheme = vi.fn<ReturnType<typeof import('next-themes').useTheme>['setTheme']>();
const mockUseTheme = vi.hoisted(() => vi.fn<typeof import('next-themes').useTheme>());

vi.mock('next-themes', async () => {
  const { stubModule } = await import('../../../test/typed-mock.js');
  return stubModule<typeof import('next-themes')>({ useTheme: mockUseTheme });
});

const themes: ThemeOption[] = [
  { value: 'light', label: 'Light', icon: <span>☀️</span> },
  { value: 'dark', label: 'Dark', icon: <span>🌙</span> },
  { value: 'high-contrast', label: 'High Contrast' },
];
const THEME_VALUES = themes.map((theme) => theme.value);

function makeProps() {
  return {
    themes,
    renderTrigger: ({
      srLabel,
      disabled,
    }: {
      activeIcon: React.ReactNode;
      srLabel: string;
      disabled: boolean;
    }) => (
      <button disabled={disabled} aria-label={srLabel}>
        toggle
      </button>
    ),
    renderMenu: ({
      trigger,
      children,
    }: {
      trigger: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <>
        {trigger}
        <ul>{children}</ul>
      </>
    ),
    renderItem: ({
      option,
      isActive,
      onSelect,
    }: {
      option: ThemeOption;
      isActive: boolean;
      onSelect: () => void;
    }) => (
      <li key={option.value}>
        <button onClick={onSelect} data-active={isActive ? 'true' : 'false'}>
          {option.label}
        </button>
      </li>
    ),
  };
}

beforeEach(() => {
  mockSetTheme.mockClear();
  mockUseTheme.mockReturnValue({ themes: THEME_VALUES, theme: 'light', setTheme: mockSetTheme });
});

describe('ThemeSwitcher', () => {
  it('calls renderTrigger with the srLabel and a disabled flag', () => {
    const renderTrigger = vi.fn(
      ({
        srLabel,
        disabled,
      }: {
        activeIcon: React.ReactNode;
        srLabel: string;
        disabled: boolean;
      }) => (
        <button disabled={disabled} aria-label={srLabel}>
          toggle
        </button>
      ),
    );
    render(<ThemeSwitcher {...makeProps()} renderTrigger={renderTrigger} />);
    expect(renderTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ srLabel: 'Toggle theme' }),
    );
  });

  it('renders menu items after mount', () => {
    render(<ThemeSwitcher {...makeProps()} />);
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
    mockUseTheme.mockReturnValue({ themes: THEME_VALUES, theme: 'dark', setTheme: mockSetTheme });
    render(<ThemeSwitcher {...makeProps()} />);
    const darkBtn = screen.getByText('Dark').closest('button');
    expect(darkBtn).toHaveAttribute('data-active', 'true');
    const lightBtn = screen.getByText('Light').closest('button');
    expect(lightBtn).toHaveAttribute('data-active', 'false');
  });

  it('passes custom srLabel to renderTrigger', () => {
    const renderTrigger = vi.fn(
      ({ srLabel }: { activeIcon: React.ReactNode; srLabel: string; disabled: boolean }) => (
        <button aria-label={srLabel}>toggle</button>
      ),
    );
    render(<ThemeSwitcher {...makeProps()} renderTrigger={renderTrigger} srLabel="Pick a theme" />);
    expect(renderTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ srLabel: 'Pick a theme' }),
    );
  });

  it('passes the trigger node into renderMenu after mount', () => {
    const renderMenu = vi.fn(
      ({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) => (
        <div>
          <div data-testid="trigger-slot">{trigger}</div>
          <ul>{children}</ul>
        </div>
      ),
    );
    render(<ThemeSwitcher {...makeProps()} renderMenu={renderMenu} />);
    expect(renderMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: anything(),
        children: anything(),
      }),
    );
    const slot = screen.getByTestId('trigger-slot');
    expect(slot.querySelector('button')).not.toBeNull();
  });
});
