import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSafeAreaInsets } from '../src/react/safe-area/useSafeAreaInsets';

afterEach(() => {
  ['top', 'right', 'bottom', 'left'].forEach((side) => {
    document.documentElement.style.removeProperty(`--app-sai-${side}`);
    document.documentElement.style.removeProperty(`--x-sai-${side}`);
  });
});

describe('useSafeAreaInsets', () => {
  it('sets --app-sai-* CSS vars by default', () => {
    renderHook(() => useSafeAreaInsets());
    expect(document.documentElement.style.getPropertyValue('--app-sai-top')).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--app-sai-bottom')).toBeTruthy();
  });

  it('sets --x-sai-* CSS vars when prefix is "x"', () => {
    renderHook(() => useSafeAreaInsets({ cssPrefix: 'x' }));
    expect(document.documentElement.style.getPropertyValue('--x-sai-top')).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--app-sai-top')).toBe('');
  });

  it('returns an insets object with numeric keys in jsdom', () => {
    const { result } = renderHook(() => useSafeAreaInsets());
    expect(result.current).toHaveProperty('top');
    expect(result.current).toHaveProperty('right');
    expect(result.current).toHaveProperty('bottom');
    expect(result.current).toHaveProperty('left');
  });
});
