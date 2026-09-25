import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { ThemeSwitcher, type ThemeOption } from '../src/react/theme-switcher';
import { ViewerSettingsSyncProvider } from '../src/react/viewer-settings-sync';
import { REDUCED_MOTION_ATTRIBUTE } from '../src/reduced-motion';
import { installMatchMedia, removeMatchMedia } from './support/match-media';
import { NOTHING, createSyncFixture, fakeAccount } from './support/viewer-settings-fixture';

const { keys, motion, Harness, seedDevice, sync, promptText } = createSyncFixture('test');

function storedDismissals(): unknown {
  const stored = window.localStorage.getItem(keys.dismissal);
  return stored === null ? null : JSON.parse(stored);
}

/** Another tab's save of a setting: storage changes and only the native `storage` event arrives here. */
function saveInAnotherTab(key: string, value: string) {
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
}

describe('ViewerSettingsSyncProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
    installMatchMedia();
    // ThemeProvider's missing-brand-token warning is not under test here.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    removeMatchMedia();
    vi.restoreAllMocks();
  });

  describe('changes', () => {
    it('signed out, saves a change on the device only', async () => {
      const account = fakeAccount();
      render(<Harness account={account} initial={undefined} accountId={null} />);

      await act(async () => {
        await sync().setTheme('dark');
        await sync().setReducedMotion(true);
      });

      expect(window.localStorage.getItem(keys.theme)).toBe('dark');
      expect(window.localStorage.getItem(keys.motion)).toBe('true');
      expect(account.save).not.toHaveBeenCalled();
      expect(promptText()).toBe('none');
    });

    it('signed in, saves a change on the device at once and then to the account', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'light', reducedMotion: false }} />);
      account.holding = true;

      let saving!: Promise<void>;
      act(() => {
        saving = sync().setTheme('dark');
      });
      expect(window.localStorage.getItem(keys.theme)).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(account.save).toHaveBeenCalledWith({ theme: 'dark' });
      expect(promptText()).toBe('none');

      await act(async () => {
        account.apply(account.held[0].values);
        account.held[0].resolve();
        await saving;
      });
      expect(promptText()).toBe('none');
    });

    it('rejects a change whose account save fails, keeping it on the device', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'light', reducedMotion: false }} />);
      const failure = new Error('offline');
      account.failure = failure;

      await act(async () => {
        await expect(sync().setTheme('dark')).rejects.toBe(failure);
      });
      expect(window.localStorage.getItem(keys.theme)).toBe('dark');
      expect(account.onSilentSaveError).not.toHaveBeenCalled();
      expect(promptText()).toBe('none');
    });

    it('does not ask about two quick changes to different settings while their saves land one by one', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'light', reducedMotion: false }} />);
      account.holding = true;

      let themeSave!: Promise<void>;
      let motionSave!: Promise<void>;
      act(() => {
        themeSave = sync().setTheme('dark');
        motionSave = sync().setReducedMotion(true);
      });
      const [first, second] = account.held;

      await act(async () => {
        account.apply(first.values);
        first.resolve();
        await themeSave;
      });
      expect(promptText()).toBe('none');

      await act(async () => {
        account.apply(second.values);
        second.resolve();
        await motionSave;
      });
      expect(promptText()).toBe('none');
    });

    it('does not ask about a change whose save is pending, or landed but not yet read, when the account first loads', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={undefined} />);
      account.holding = true;

      let saving!: Promise<void>;
      act(() => {
        saving = sync().setTheme('dark');
      });
      // The account's first read arrives before the save: it still holds the old theme.
      act(() => account.setSettings({ theme: 'light', reducedMotion: false }));
      expect(promptText()).toBe('none');

      // The save lands before the account's values show it.
      await act(async () => {
        account.held[0].resolve();
        await saving;
      });
      expect(promptText()).toBe('none');

      act(() => account.apply({ theme: 'dark' }));
      expect(promptText()).toBe('none');
    });

    it('keeps its record through a read that fails and recovers, so a change still saving is not asked about', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'light', reducedMotion: false }} />);
      account.holding = true;

      let saving!: Promise<void>;
      act(() => {
        saving = sync().setTheme('dark');
      });
      // The account's read fails, then recovers before the save lands: it still holds the old theme.
      act(() => account.setSettings(undefined));
      expect(promptText()).toBe('none');
      act(() => account.setSettings({ theme: 'light', reducedMotion: false }));
      expect(promptText()).toBe('none');

      await act(async () => {
        account.apply(account.held[0].values);
        account.held[0].resolve();
        await saving;
      });
      expect(promptText()).toBe('none');
    });

    it('starts a new account clean when the last account\'s save is still in flight', () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      account.holding = true;
      const { rerender } = render(<Harness account={account} initial={undefined} accountId="viewer-a" />);

      // Signed in, the viewer picks a theme before the account's settings are read, then signs out
      // before the read; a second account signs in and its settings load.
      act(() => {
        void sync().setTheme('dark');
      });
      rerender(<Harness account={account} initial={undefined} accountId={null} />);
      rerender(<Harness account={account} initial={undefined} accountId="viewer-b" />);
      act(() => account.setSettings({ theme: 'light', reducedMotion: false }));

      expect(sync().prompt?.differences).toEqual([{ setting: 'theme', device: 'dark', account: 'light' }]);
    });

    it('does not ask about another tab\'s change when this tab\'s save of a different setting lands first', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'light', reducedMotion: false }} />);

      act(() => saveInAnotherTab(keys.motion, 'true'));
      expect(promptText()).toBe('none');

      // This tab's theme save lands; the other tab's motion save has not.
      await act(async () => {
        await sync().setTheme('dark');
      });
      expect(promptText()).toBe('none');

      act(() => account.apply({ reducedMotion: true }));
      expect(promptText()).toBe('none');
    });

    it('routes ThemeSwitcher through the sync, so a signed-in pick reaches the account', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      const themes: ThemeOption[] = [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ];
      render(
        <Harness account={account} initial={{ theme: 'light', reducedMotion: false }}>
          <ThemeSwitcher
            themes={themes}
            renderTrigger={({ srLabel }) => <button aria-label={srLabel}>toggle</button>}
            renderMenu={({ trigger, children }) => (
              <>
                {trigger}
                <ul>{children}</ul>
              </>
            )}
            renderItem={({ option, onSelect }) => (
              <li key={option.value}>
                <button onClick={() => void onSelect()}>{option.label}</button>
              </li>
            )}
          />
        </Harness>,
      );

      await act(async () => {
        fireEvent.click(screen.getByText('Dark'));
      });
      expect(window.localStorage.getItem(keys.theme)).toBe('dark');
      expect(account.save).toHaveBeenCalledWith({ theme: 'dark' });
    });
  });

  describe('silent adopt and save', () => {
    it('gives a device with nothing saved the account\'s values without asking', () => {
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);

      expect(window.localStorage.getItem(keys.theme)).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(window.localStorage.getItem(keys.motion)).toBe('true');
      expect(document.documentElement.getAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe('true');
      expect(account.save).not.toHaveBeenCalled();
      expect(promptText()).toBe('none');
    });

    it('saves the theme already on screen when it is the one the account holds', () => {
      // next-themes shows its default "light" with nothing saved; adopting "light" must still save it.
      render(<Harness account={fakeAccount()} initial={{ theme: 'light', reducedMotion: null }} />);
      expect(window.localStorage.getItem(keys.theme)).toBe('light');
      expect(promptText()).toBe('none');
    });

    it('compares nothing until the account\'s values have loaded', () => {
      seedDevice({ theme: 'light' });
      const account = fakeAccount();
      render(<Harness account={account} initial={undefined} />);
      expect(account.save).not.toHaveBeenCalled();
      expect(promptText()).toBe('none');

      act(() => account.setSettings({ theme: 'dark', reducedMotion: null }));
      expect(sync().prompt?.differences).toEqual([{ setting: 'theme', device: 'light', account: 'dark' }]);
    });

    it('saves the device\'s values to an account with nothing saved, without asking', async () => {
      seedDevice({ theme: 'dark', reducedMotion: true });
      const account = fakeAccount();
      render(<Harness account={account} initial={NOTHING} />);
      await act(async () => {
        await account.save.mock.results[0].value;
      });

      expect(account.save).toHaveBeenCalledTimes(1);
      expect(account.save).toHaveBeenCalledWith({ theme: 'dark', reducedMotion: true });
      expect(promptText()).toBe('none');
    });

    it('reports a failed silent save and does not retry it', async () => {
      seedDevice({ theme: 'dark' });
      const account = fakeAccount();
      const failure = new Error('offline');
      account.failure = failure;
      const { rerender } = render(<Harness account={account} initial={NOTHING} />);

      await act(async () => {
        await account.save.mock.results[0].value.catch(() => {});
      });
      expect(account.onSilentSaveError).toHaveBeenCalledWith(failure);

      rerender(<Harness account={account} initial={NOTHING} />);
      rerender(<Harness account={account} initial={NOTHING} />);
      expect(account.save).toHaveBeenCalledTimes(1);
      expect(promptText()).toBe('none');
    });

    it('gives a second account signing in on the same device its own silent save', () => {
      seedDevice({ theme: 'dark' });
      const account = fakeAccount();
      account.holding = true;
      const { rerender } = render(<Harness account={account} initial={NOTHING} accountId="viewer-a" />);
      expect(account.save).toHaveBeenCalledTimes(1);

      // The first account signs out with its save still in flight; a second one signs in and its
      // empty settings load.
      rerender(<Harness account={account} initial={NOTHING} accountId={null} />);
      act(() => account.setSettings(undefined));
      rerender(<Harness account={account} initial={NOTHING} accountId="viewer-b" />);
      act(() => account.setSettings(NOTHING));

      expect(account.save).toHaveBeenCalledTimes(2);
      expect(account.save).toHaveBeenLastCalledWith({ theme: 'dark' });
    });

    it('keeps a failed silent save unretried through a read that fails and recovers', async () => {
      seedDevice({ theme: 'dark' });
      const account = fakeAccount();
      account.failure = new Error('offline');
      render(<Harness account={account} initial={NOTHING} />);
      await act(async () => {
        await account.save.mock.results[0].value.catch(() => {});
      });

      act(() => account.setSettings(undefined));
      act(() => account.setSettings(NOTHING));
      expect(account.save).toHaveBeenCalledTimes(1);
    });

    it('never lets a saved value force motion on while the device asks for less', () => {
      installMatchMedia({ reducedMotion: true });
      render(<Harness account={fakeAccount()} initial={{ theme: null, reducedMotion: false }} />);

      expect(window.localStorage.getItem(keys.motion)).toBe('false');
      expect(motion.prefersReducedMotion()).toBe(true);
      expect(document.documentElement.getAttribute(REDUCED_MOTION_ATTRIBUTE)).toBe('true');
    });
  });

  describe('the prompt', () => {
    it('covers every setting whose values differ, leaving the device as it is', () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);

      expect(sync().prompt?.differences).toEqual([
        { setting: 'theme', device: 'light', account: 'dark' },
        { setting: 'reducedMotion', device: false, account: true },
      ]);
      expect(window.localStorage.getItem(keys.theme)).toBe('light');
      expect(window.localStorage.getItem(keys.motion)).toBe('false');
      expect(account.save).not.toHaveBeenCalled();
    });

    it('applies the account\'s values to the device when the viewer chooses them', () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);

      act(() => sync().prompt!.adoptAccountSettings());

      expect(window.localStorage.getItem(keys.theme)).toBe('dark');
      expect(window.localStorage.getItem(keys.motion)).toBe('true');
      expect(promptText()).toBe('none');
      expect(account.save).not.toHaveBeenCalled();
    });

    it('saves the device\'s values to the account when the viewer chooses them, staying until they land', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);
      account.holding = true;

      let saving!: Promise<void>;
      act(() => {
        saving = sync().prompt!.saveDeviceSettings();
      });
      expect(account.save).toHaveBeenCalledWith({ theme: 'light', reducedMotion: false });
      expect(promptText()).not.toBe('none');

      await act(async () => {
        account.apply(account.held[0].values);
        account.held[0].resolve();
        await saving;
      });
      expect(promptText()).toBe('none');
      expect(window.localStorage.getItem(keys.theme)).toBe('light');
    });

    it('keeps the device\'s values on dismiss and does not ask about the same differences again', () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      const { unmount } = render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);

      act(() => sync().prompt!.dismiss());
      expect(promptText()).toBe('none');
      expect(window.localStorage.getItem(keys.theme)).toBe('light');
      expect(storedDismissals()).toEqual([
        ['theme', 'light', 'dark'],
        ['reducedMotion', false, true],
      ]);

      // The next page load finds the same differences and stays quiet.
      unmount();
      render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);
      expect(promptText()).toBe('none');
    });

    it('does not re-ask a dismissed difference after the viewer changes another setting', async () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);
      act(() => sync().prompt!.dismiss());

      await act(async () => {
        await sync().setTheme('dark');
      });
      expect(promptText()).toBe('none');
      expect(storedDismissals()).toEqual([['reducedMotion', false, true]]);
    });

    it('asks again, about that difference alone, once a dismissed difference changes', () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: true }} />);
      act(() => sync().prompt!.dismiss());

      act(() => account.setSettings({ theme: 'high-contrast', reducedMotion: true }));
      expect(sync().prompt?.differences).toEqual([
        { setting: 'theme', device: 'light', account: 'high-contrast' },
      ]);
    });

    it('forgets every dismissal once the device and account agree', () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'dark', reducedMotion: false }} />);
      act(() => sync().prompt!.dismiss());
      expect(storedDismissals()).not.toBeNull();

      act(() => account.setSettings({ theme: 'light', reducedMotion: false }));
      expect(storedDismissals()).toBeNull();
    });

    it('does not ask about a change another tab made on this device', () => {
      seedDevice({ theme: 'light', reducedMotion: false });
      const account = fakeAccount();
      render(<Harness account={account} initial={{ theme: 'light', reducedMotion: false }} />);

      act(() => saveInAnotherTab(keys.theme, 'dark'));
      expect(promptText()).toBe('none');

      // The other tab's save reaches the account.
      act(() => account.apply({ theme: 'dark' }));
      expect(promptText()).toBe('none');
    });
  });

  describe('hydration and mounting', () => {
    it('compares only after hydration, so the device keeps its saved theme and the viewer is asked', async () => {
      seedDevice({ theme: 'light' });
      const account = fakeAccount();
      const element = <Harness account={account} initial={{ theme: 'dark', reducedMotion: null }} />;
      const container = document.createElement('div');
      container.innerHTML = renderToString(element);
      document.body.appendChild(container);

      // A hydration mismatch would fall back to a client render, which never sees server snapshots.
      const onRecoverableError = vi.fn();
      let root!: Root;
      await act(async () => {
        root = hydrateRoot(container, element, { onRecoverableError });
      });

      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(keys.theme)).toBe('light');
      expect(sync().prompt?.differences).toEqual([{ setting: 'theme', device: 'light', account: 'dark' }]);
      act(() => root.unmount());
      container.remove();
    });

    it('exposes the theme the device shows', () => {
      seedDevice({ theme: 'high-contrast' });
      render(<Harness account={fakeAccount()} initial={undefined} accountId={null} />);
      expect(sync().theme).toBe('high-contrast');
    });

    it('must be mounted inside ThemeProvider', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const account = fakeAccount();
      expect(() =>
        render(
          <ViewerSettingsSyncProvider
            motion={motion}
            dismissalStorageKey={keys.dismissal}
            account={{
              accountId: null,
              settings: undefined,
              save: account.save,
              onSilentSaveError: account.onSilentSaveError,
            }}
          >
            <span />
          </ViewerSettingsSyncProvider>,
        ),
      ).toThrow(/inside theme-core's ThemeProvider/);
    });
  });
});
