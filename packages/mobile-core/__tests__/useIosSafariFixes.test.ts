import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// The env flags the hook reads, set per case: the mock reads them when the hook runs.
const env = vi.hoisted(() => ({ isBrowser: true, isIOS: false, isSafari: false }));
vi.mock('../src/env.js', () => ({
  get isBrowser() {
    return env.isBrowser;
  },
  get isIOS() {
    return env.isIOS;
  },
  get isSafari() {
    return env.isSafari;
  },
}));

import { useIosSafariFixes } from '../src/react/ios/useIosSafariFixes.js';

afterEach(() => {
  document.documentElement.className = '';
  Object.assign(env, { isBrowser: true, isIOS: false, isSafari: false });
});

describe('useIosSafariFixes', () => {
  it('adds app-ios-safari class on iOS Safari (default prefix)', () => {
    Object.assign(env, { isIOS: true, isSafari: true });
    renderHook(() => useIosSafariFixes());
    expect(document.documentElement.classList.contains('app-ios-safari')).toBe(true);
  });

  it('adds x-ios-safari class when prefix is "x"', () => {
    Object.assign(env, { isIOS: true, isSafari: true });
    renderHook(() => useIosSafariFixes({ cssPrefix: 'x' }));
    expect(document.documentElement.classList.contains('x-ios-safari')).toBe(true);
  });

  it('does not add class when not iOS', () => {
    Object.assign(env, { isIOS: false, isSafari: true });
    renderHook(() => useIosSafariFixes());
    expect(document.documentElement.classList.contains('app-ios-safari')).toBe(false);
  });
});
