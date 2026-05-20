import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

afterEach(() => {
  document.documentElement.className = '';
  vi.resetModules();
});

describe('useIosSafariFixes', () => {
  it('adds app-ios-safari class on iOS Safari (default prefix)', async () => {
    vi.doMock('../src/env', () => ({
      isBrowser: true,
      isIOS: true,
      isSafari: true,
    }));
    const { useIosSafariFixes } = await import('../src/react/ios/useIosSafariFixes');
    renderHook(() => useIosSafariFixes());
    expect(document.documentElement.classList.contains('app-ios-safari')).toBe(true);
  });

  it('adds x-ios-safari class when prefix is "x"', async () => {
    vi.doMock('../src/env', () => ({
      isBrowser: true,
      isIOS: true,
      isSafari: true,
    }));
    const { useIosSafariFixes } = await import('../src/react/ios/useIosSafariFixes');
    renderHook(() => useIosSafariFixes({ cssPrefix: 'x' }));
    expect(document.documentElement.classList.contains('x-ios-safari')).toBe(true);
  });

  it('does not add class when not iOS', async () => {
    vi.doMock('../src/env', () => ({
      isBrowser: true,
      isIOS: false,
      isSafari: true,
    }));
    const { useIosSafariFixes } = await import('../src/react/ios/useIosSafariFixes');
    renderHook(() => useIosSafariFixes());
    expect(document.documentElement.classList.contains('app-ios-safari')).toBe(false);
  });
});
