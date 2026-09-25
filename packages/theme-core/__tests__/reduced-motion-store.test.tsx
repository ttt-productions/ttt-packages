import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { createReducedMotionStore } from '../src/react/reduced-motion-store';
import { REDUCED_MOTION_ATTRIBUTE } from '../src/reduced-motion';
import { installMatchMedia, removeMatchMedia } from './support/match-media';

const STORAGE_KEY = 'test-reduced-motion';
const CHANGE_EVENT = 'test-reduced-motion-change';

const store = createReducedMotionStore({ storageKey: STORAGE_KEY, changeEvent: CHANGE_EVENT });

function attribute() {
  return document.documentElement.getAttribute(REDUCED_MOTION_ATTRIBUTE);
}

function Probe() {
  const reduced = store.useReducedMotion();
  const device = store.useDeviceReducedMotion();
  const saved = store.useSavedReducedMotion();
  return <span data-testid="probe">{`${reduced}|${device}|${saved}`}</span>;
}

function ApplyProbe() {
  store.useApplyReducedMotion();
  return null;
}

/** Another tab's save: storage changes and only the native `storage` event reaches this tab. */
function saveInAnotherTab(value: string) {
  window.localStorage.setItem(STORAGE_KEY, value);
  window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: value }));
}

describe('createReducedMotionStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
    removeMatchMedia();
  });
  afterEach(() => {
    removeMatchMedia();
  });

  it('is full motion with nothing saved and no device request', () => {
    expect(store.deviceReducedMotion()).toBe(false);
    expect(store.savedReducedMotion()).toBeNull();
    expect(store.prefersReducedMotion()).toBe(false);
  });

  it('saves under the app\'s key and stamps the <html> attribute at once', () => {
    store.setSavedReducedMotion(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
    expect(store.savedReducedMotion()).toBe(true);
    expect(store.prefersReducedMotion()).toBe(true);
    expect(attribute()).toBe('true');

    store.setSavedReducedMotion(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('false');
    expect(store.savedReducedMotion()).toBe(false);
    expect(store.prefersReducedMotion()).toBe(false);
    expect(attribute()).toBeNull();
  });

  it('keeps motion reduced while the device asks for less, even with "full motion" saved', () => {
    installMatchMedia({ reducedMotion: true });
    store.setSavedReducedMotion(false);
    expect(store.savedReducedMotion()).toBe(false);
    expect(store.deviceReducedMotion()).toBe(true);
    expect(store.prefersReducedMotion()).toBe(true);
    expect(attribute()).toBe('true');
  });

  it('dispatches the app\'s change event on every save', () => {
    let fired = 0;
    const onChange = () => {
      fired += 1;
    };
    window.addEventListener(CHANGE_EVENT, onChange);
    try {
      store.setSavedReducedMotion(true);
      store.setSavedReducedMotion(false);
      expect(fired).toBe(2);
    } finally {
      window.removeEventListener(CHANGE_EVENT, onChange);
    }
  });

  it('updates its hooks on a save in the same tab', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('false|false|null');
    act(() => store.setSavedReducedMotion(true));
    expect(screen.getByTestId('probe')).toHaveTextContent('true|false|true');
    act(() => store.setSavedReducedMotion(false));
    expect(screen.getByTestId('probe')).toHaveTextContent('false|false|false');
  });

  it('updates its hooks on a save in another tab', () => {
    render(<Probe />);
    act(() => saveInAnotherTab('true'));
    expect(screen.getByTestId('probe')).toHaveTextContent('true|false|true');
  });

  it('updates its hooks when the device request changes, leaving the saved value alone', () => {
    const device = installMatchMedia({ reducedMotion: false });
    render(<Probe />);
    act(() => device.setReducedMotion(true));
    expect(screen.getByTestId('probe')).toHaveTextContent('true|true|null');
  });

  it('keeps the <html> attribute in step through useApplyReducedMotion', () => {
    const device = installMatchMedia({ reducedMotion: false });
    render(<ApplyProbe />);
    expect(attribute()).toBeNull();
    act(() => saveInAnotherTab('true'));
    expect(attribute()).toBe('true');
    act(() => saveInAnotherTab('false'));
    expect(attribute()).toBeNull();
    act(() => device.setReducedMotion(true));
    expect(attribute()).toBe('true');
  });

  it('keeps stores with different keys independent', () => {
    const other = createReducedMotionStore({ storageKey: 'other-motion', changeEvent: 'other-motion-change' });
    store.setSavedReducedMotion(true);
    expect(other.savedReducedMotion()).toBeNull();
    expect(other.prefersReducedMotion()).toBe(false);
  });
});
