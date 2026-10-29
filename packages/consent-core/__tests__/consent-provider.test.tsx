import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { createConsentStore } from '../src/react/consent-store.js';
import { ConsentProvider, useConsent } from '../src/react/consent-provider.js';
import { CookieConsentBanner, CookieSettingsButton } from '../src/react/consent-controls.js';

const STORAGE_KEY = 'test-consent';
const CHANGE_EVENT = 'test-consent-change';

const store = createConsentStore({ storageKey: STORAGE_KEY, changeEvent: CHANGE_EVENT });
const onAnalyticsChange = vi.fn<(enabled: boolean) => void>();

function Harness() {
  const { consent, analyticsEnabled, accept, decline, reopen } = useConsent();
  return (
    <div>
      <span data-testid="consent">{consent}</span>
      <span data-testid="enabled">{String(analyticsEnabled)}</span>
      <button onClick={accept}>accept</button>
      <button onClick={decline}>decline</button>
      <button onClick={reopen}>reopen</button>
    </div>
  );
}

function renderWithProvider(children = <Harness />) {
  return render(
    <ConsentProvider store={store} onAnalyticsChange={onAnalyticsChange}>
      {children}
    </ConsentProvider>,
  );
}

const consent = () => screen.getByTestId('consent').textContent;
const lastSwitch = () => onAnalyticsChange.mock.calls.at(-1)?.[0];

function storeFromOtherTab(value: 'granted' | 'denied' | null, key: string | null = STORAGE_KEY) {
  act(() => {
    if (key === null) window.localStorage.clear();
    else if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  onAnalyticsChange.mockClear();
});

describe('ConsentProvider', () => {
  it('starts unset with analytics off until the visitor chooses (opt-in)', () => {
    renderWithProvider();
    expect(consent()).toBe('unset');
    expect(screen.getByTestId('enabled').textContent).toBe('false');
    expect(lastSwitch()).toBe(false);
  });

  it('turns analytics on when the visitor accepts, and persists the choice', () => {
    renderWithProvider();
    act(() => screen.getByText('accept').click());
    expect(consent()).toBe('granted');
    expect(lastSwitch()).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('granted');
  });

  it('keeps analytics off when the visitor declines', () => {
    renderWithProvider();
    act(() => screen.getByText('decline').click());
    expect(consent()).toBe('denied');
    expect(lastSwitch()).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('denied');
  });

  it('reopening clears the stored choice and turns analytics off', () => {
    window.localStorage.setItem(STORAGE_KEY, 'granted');
    renderWithProvider();
    act(() => screen.getByText('reopen').click());
    expect(consent()).toBe('unset');
    expect(lastSwitch()).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('a stored grant turns analytics on when the page loads', () => {
    window.localStorage.setItem(STORAGE_KEY, 'granted');
    renderWithProvider();
    expect(consent()).toBe('granted');
    expect(onAnalyticsChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('a stored value that is not a choice reads as unset', () => {
    window.localStorage.setItem(STORAGE_KEY, 'maybe');
    renderWithProvider();
    expect(consent()).toBe('unset');
  });

  it('switches analytics before consumers re-render with the new choice', () => {
    const seen: Array<{ consent: string; switchedOn: boolean | undefined }> = [];
    function Watcher() {
      const value = useConsent();
      seen.push({ consent: value.consent, switchedOn: lastSwitch() });
      return null;
    }
    renderWithProvider(
      <>
        <Harness />
        <Watcher />
      </>,
    );
    act(() => screen.getByText('accept').click());
    expect(seen.at(-1)).toEqual({ consent: 'granted', switchedOn: true });
  });
});

describe('ConsentProvider — a choice made in another tab', () => {
  it('a withdrawal there turns analytics off here', () => {
    window.localStorage.setItem(STORAGE_KEY, 'granted');
    renderWithProvider();
    storeFromOtherTab('denied');
    expect(consent()).toBe('denied');
    expect(lastSwitch()).toBe(false);
  });

  it('an accept there turns analytics on here', () => {
    renderWithProvider();
    storeFromOtherTab('granted');
    expect(consent()).toBe('granted');
    expect(lastSwitch()).toBe(true);
  });

  it('a reopened choice there returns this tab to unset, analytics off', () => {
    window.localStorage.setItem(STORAGE_KEY, 'granted');
    renderWithProvider();
    storeFromOtherTab(null);
    expect(consent()).toBe('unset');
    expect(lastSwitch()).toBe(false);
  });

  it('cleared storage there returns this tab to unset', () => {
    window.localStorage.setItem(STORAGE_KEY, 'granted');
    renderWithProvider();
    storeFromOtherTab(null, null);
    expect(consent()).toBe('unset');
    expect(lastSwitch()).toBe(false);
  });

  it('an unrelated storage key changes nothing', () => {
    renderWithProvider();
    onAnalyticsChange.mockClear();
    storeFromOtherTab('granted', 'some-other-key');
    expect(consent()).toBe('unset');
    expect(onAnalyticsChange).not.toHaveBeenCalled();
  });
});

describe('useConsent outside its provider', () => {
  it('fails safe: unset, analytics off, not ready, and the actions do nothing', () => {
    render(<Harness />);
    expect(consent()).toBe('unset');
    expect(screen.getByTestId('enabled').textContent).toBe('false');
    act(() => screen.getByText('accept').click());
    expect(consent()).toBe('unset');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

const BANNER_COPY = {
  regionLabel: 'Cookie consent',
  message: <span>We use analytics cookies.</span>,
  acceptLabel: 'Accept',
  declineLabel: 'Decline',
};

describe('CookieConsentBanner', () => {
  it("shows the app's wording while no choice is made", () => {
    renderWithProvider(<CookieConsentBanner copy={BANNER_COPY} />);
    const banner = screen.getByRole('region', { name: 'Cookie consent' });
    expect(banner.textContent).toContain('We use analytics cookies.');
  });

  it('clears the home indicator and fades in on the motion tokens', () => {
    renderWithProvider(<CookieConsentBanner copy={BANNER_COPY} />);
    const classes = screen.getByRole('region', { name: 'Cookie consent' }).className.split(' ');
    expect(classes).toContain('pb-[max(1rem,env(safe-area-inset-bottom))]');
    expect(classes).toEqual(
      expect.arrayContaining([
        'starting:opacity-0',
        'duration-[var(--motion-base)]',
        'ease-[var(--motion-ease)]',
        'motion-reduce:transition-none',
      ]),
    );
  });

  it('accepting hides it and turns analytics on', () => {
    renderWithProvider(<CookieConsentBanner copy={BANNER_COPY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
    expect(lastSwitch()).toBe(true);
  });

  it('declining hides it and keeps analytics off', () => {
    renderWithProvider(<CookieConsentBanner copy={BANNER_COPY} />);
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('denied');
  });

  it('stays hidden once a choice is stored', () => {
    window.localStorage.setItem(STORAGE_KEY, 'denied');
    renderWithProvider(<CookieConsentBanner copy={BANNER_COPY} />);
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
  });
});

describe('CookieSettingsButton', () => {
  it('reopens the choice, bringing the banner back', () => {
    window.localStorage.setItem(STORAGE_KEY, 'granted');
    renderWithProvider(
      <>
        <CookieConsentBanner copy={BANNER_COPY} />
        <CookieSettingsButton variant="outline">Cookie Settings</CookieSettingsButton>
      </>,
    );
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cookie Settings' }));
    expect(screen.getByRole('region', { name: 'Cookie consent' })).toBeTruthy();
    expect(lastSwitch()).toBe(false);
  });

  it('is a plain button that never submits a surrounding form', () => {
    renderWithProvider(<CookieSettingsButton>Cookie Settings</CookieSettingsButton>);
    expect(screen.getByRole('button', { name: 'Cookie Settings' }).getAttribute('type')).toBe(
      'button',
    );
  });
});
