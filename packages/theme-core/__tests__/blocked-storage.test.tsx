import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createReducedMotionStore } from '../src/react/reduced-motion-store';
import { REDUCED_MOTION_ATTRIBUTE } from '../src/reduced-motion';
import { installMatchMedia, removeMatchMedia } from './support/match-media';
import { createSyncFixture, fakeAccount } from './support/viewer-settings-fixture';

// A browser that blocks site data throws on localStorage. Values held for the page live for the
// module's life, so every test takes its own keys.
let nextPrefix = 0;
function uniquePrefix() {
  nextPrefix += 1;
  return `blocked-${nextPrefix}`;
}

const blocked = () => new DOMException('The operation is insecure.', 'SecurityError');
const ownLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');

const BLOCKING_MODES: Array<[string, () => void]> = [
  [
    'every Storage call throws',
    () => {
      for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
        vi.spyOn(Storage.prototype, method).mockImplementation(() => {
          throw blocked();
        });
      }
    },
  ],
  [
    'reading window.localStorage throws',
    () => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw blocked();
        },
      });
    },
  ],
];

describe.each(BLOCKING_MODES)('with blocked storage (%s)', (_mode, block) => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
    installMatchMedia();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    block();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (ownLocalStorage) Object.defineProperty(window, 'localStorage', ownLocalStorage);
    else delete (window as unknown as { localStorage?: unknown }).localStorage;
    removeMatchMedia();
  });

  it('reads nothing saved, and the shell\'s motion hook renders', () => {
    const prefix = uniquePrefix();
    const store = createReducedMotionStore({ storageKey: `${prefix}-motion`, changeEvent: `${prefix}-change` });
    function Shell() {
      store.useApplyReducedMotion();
      return <span data-testid="reduced">{String(store.useReducedMotion())}</span>;
    }

    render(<Shell />);
    expect(store.savedReducedMotion()).toBeNull();
    expect(screen.getByTestId('reduced')).toHaveTextContent('false');
  });

  it('still applies a motion save for the rest of the page', () => {
    const prefix = uniquePrefix();
    const store = createReducedMotionStore({ storageKey: `${prefix}-motion`, changeEvent: `${prefix}-change` });
    function Shell() {
      store.useApplyReducedMotion();
      return <span data-testid="reduced">{String(store.useReducedMotion())}</span>;
    }
    render(<Shell />);

    act(() => store.setSavedReducedMotion(true));
    expect(store.savedReducedMotion()).toBe(true);
    expect(screen.getByTestId('reduced')).toHaveTextContent('true');
    expect(document.documentElement.getAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe('true');
  });

  it('renders the sync signed out, and a change still applies for the page', async () => {
    const { Harness, motion, sync } = createSyncFixture(uniquePrefix());
    render(<Harness account={fakeAccount()} initial={undefined} accountId={null} />);

    await act(async () => {
      await sync().setTheme('dark');
      await sync().setReducedMotion(true);
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(sync().theme).toBe('dark');
    expect(motion.prefersReducedMotion()).toBe(true);
  });

  it('signed in, takes the account\'s values and still honours a dismissal', () => {
    const { Harness, motion, sync, promptText } = createSyncFixture(uniquePrefix());
    const account = fakeAccount();
    render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(motion.savedReducedMotion()).toBe(true);
    expect(promptText()).toBe('none');

    act(() => account.setSettings({ theme: 'dark', reducedMotion: false }));
    expect(sync().prompt?.differences).toEqual([{ setting: 'reducedMotion', device: true, account: false }]);
    act(() => sync().prompt!.dismiss());
    expect(promptText()).toBe('none');
  });

  it('holds a theme taken from the account, so a later account change asks instead of switching', () => {
    const { Harness, sync } = createSyncFixture(uniquePrefix());
    const account = fakeAccount();
    render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: null }} />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => account.setSettings({ theme: 'light', reducedMotion: null }));
    expect(sync().prompt?.differences).toEqual([{ setting: 'theme', device: 'dark', account: 'light' }]);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
