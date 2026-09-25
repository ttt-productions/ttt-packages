import { vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { screen } from '@testing-library/react';
import { ThemeProvider } from '../../src/react/theme-provider';
import { createReducedMotionStore } from '../../src/react/reduced-motion-store';
import {
  ViewerSettingsSyncProvider,
  useViewerSettingsSync,
  type ViewerSettingsSync,
} from '../../src/react/viewer-settings-sync';
import type { SavedViewerSettings, ViewerSettings } from '../../src/viewer-settings';

export const NOTHING: SavedViewerSettings = { theme: null, reducedMotion: null };

interface HeldSave {
  values: Partial<ViewerSettings>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * The app's account half. A save lands in the account's values at once, as a refetch would show
 * them; with `holding` set, each save waits in `held` until the test settles it.
 */
export function fakeAccount() {
  const account = {
    apply: (_values: Partial<ViewerSettings>) => {},
    setSettings: (_settings: SavedViewerSettings | undefined) => {},
    failure: null as unknown,
    holding: false,
    held: [] as HeldSave[],
    save: vi.fn((values: Partial<ViewerSettings>): Promise<void> => {
      if (account.failure) return Promise.reject(account.failure);
      if (!account.holding) {
        account.apply(values);
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        account.held.push({ values, resolve, reject });
      });
    }),
    onSilentSaveError: vi.fn(),
  };
  return account;
}

export type FakeAccount = ReturnType<typeof fakeAccount>;

/** A mounted sync under its own storage keys, so tests never read another test's values. */
export function createSyncFixture(prefix: string) {
  const keys = {
    theme: `${prefix}-theme`,
    motion: `${prefix}-reduced-motion`,
    dismissal: `${prefix}-prompt-dismissed`,
  };
  const motion = createReducedMotionStore({
    storageKey: keys.motion,
    changeEvent: `${prefix}-reduced-motion-change`,
  });
  let latest: ViewerSettingsSync | null = null;

  function Probe() {
    latest = useViewerSettingsSync();
    return <span data-testid="prompt">{latest.prompt ? JSON.stringify(latest.prompt.differences) : 'none'}</span>;
  }

  function Harness({
    account,
    initial,
    accountId = 'viewer-a',
    children,
  }: {
    account: FakeAccount;
    initial: SavedViewerSettings | undefined;
    /** The signed-in account; `null` while signed out. */
    accountId?: string | null;
    children?: ReactNode;
  }) {
    const [settings, setSettings] = useState(initial);
    account.setSettings = setSettings;
    account.apply = (values) => setSettings((previous) => ({ ...(previous ?? NOTHING), ...values }));
    return (
      <ThemeProvider storageKey={keys.theme} defaultTheme="light" enableSystem={false}>
        <ViewerSettingsSyncProvider
          motion={motion}
          dismissalStorageKey={keys.dismissal}
          // Inline, as an app builds it: new function identities on every render.
          account={{
            accountId,
            settings,
            save: (values) => account.save(values),
            onSilentSaveError: (error) => account.onSilentSaveError(error),
          }}
        >
          <Probe />
          {children}
        </ViewerSettingsSyncProvider>
      </ThemeProvider>
    );
  }

  function seedDevice({ theme, reducedMotion }: Partial<ViewerSettings>) {
    if (theme !== undefined) window.localStorage.setItem(keys.theme, theme);
    if (reducedMotion !== undefined) window.localStorage.setItem(keys.motion, String(reducedMotion));
  }

  function sync(): ViewerSettingsSync {
    if (!latest) throw new Error('The sync has not rendered.');
    return latest;
  }

  function promptText() {
    return screen.getByTestId('prompt').textContent;
  }

  return { keys, motion, Harness, seedDevice, sync, promptText };
}
