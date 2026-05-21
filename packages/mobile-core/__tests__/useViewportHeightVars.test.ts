import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewportHeightVars } from '../src/react/viewport/useViewportHeightVars';

afterEach(() => {
  document.documentElement.style.removeProperty('--app-vh');
  document.documentElement.style.removeProperty('--app-dvh');
  document.documentElement.style.removeProperty('--x-vh');
  document.documentElement.style.removeProperty('--x-dvh');
});

describe('useViewportHeightVars', () => {
  it('sets --app-vh and --app-dvh by default', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    renderHook(() => useViewportHeightVars());
    const vh = document.documentElement.style.getPropertyValue('--app-vh');
    expect(vh).toBeTruthy();
    expect(vh).toMatch(/px$/);
  });

  it('sets --x-vh and --x-dvh when prefix is "x"', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    renderHook(() => useViewportHeightVars({ cssPrefix: 'x' }));
    const xvh = document.documentElement.style.getPropertyValue('--x-vh');
    expect(xvh).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--app-vh')).toBe('');
  });
});
