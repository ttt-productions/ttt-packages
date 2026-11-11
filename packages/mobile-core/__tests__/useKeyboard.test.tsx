import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// The visual viewport is set before env.ts loads, since the module reads it once at load.
const viewport = vi.hoisted(() => {
  class FakeVisualViewport extends EventTarget {
    width = 390;
    height = 800;
    offsetTop = 0;
    scale = 1;
  }
  const fake = new FakeVisualViewport();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: fake });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
  return fake;
});

import { useKeyboard } from '../src/react/keyboard/useKeyboard.js';

function setViewportHeight(height: number) {
  act(() => {
    viewport.height = height;
    viewport.dispatchEvent(new Event('resize'));
  });
}

afterEach(() => {
  vi.useRealTimers();
  setViewportHeight(800);
  document.body.innerHTML = '';
});

afterAll(() => {
  delete (window as { visualViewport?: unknown }).visualViewport;
});

describe('useKeyboard with a visual viewport', () => {
  it('reads the keyboard open from the visual viewport shrinking under the window height', () => {
    const { result } = renderHook(() => useKeyboard());
    setViewportHeight(450);
    expect(result.current).toEqual({ isOpen: true, height: 350, source: 'visualViewport' });
  });

  it('reads the keyboard closed when the visual viewport grows back', () => {
    const { result } = renderHook(() => useKeyboard());
    setViewportHeight(450);
    setViewportHeight(800);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.height).toBe(0);
  });

  it('keeps the keyboard open while focus moves from one field to the next', () => {
    vi.useFakeTimers();
    const first = document.createElement('input');
    const second = document.createElement('input');
    document.body.append(first, second);
    const { result } = renderHook(() => useKeyboard());

    act(() => first.focus());
    setViewportHeight(450);
    act(() => second.focus());
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.height).toBe(350);
  });

  it('measures the visual viewport again after a blur and reads the keyboard closed once it has grown', () => {
    vi.useFakeTimers();
    const field = document.createElement('input');
    document.body.append(field);
    const { result } = renderHook(() => useKeyboard());

    act(() => field.focus());
    setViewportHeight(450);
    act(() => field.blur());
    viewport.height = 800;
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isOpen).toBe(false);
  });
});
