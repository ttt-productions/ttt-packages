import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import {
  useReturnScroll,
  saveReturnScroll,
  clearReturnScroll,
  readReturnScroll,
} from '../src/react/hooks/use-return-scroll';

// A controllable animation-frame queue: the hook schedules its restore in a frame, so the
// tests decide exactly when (and whether) that frame runs.
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
function flushFrames() {
  const pending = [...frames.entries()];
  frames.clear();
  for (const [, cb] of pending) cb(0);
}

const scrollTo = vi.fn();
const KEY = '/hall-library?workProjectType=Television';

beforeEach(() => {
  frames.clear();
  nextFrame = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id);
  });
  Object.defineProperty(window, 'scrollTo', { value: scrollTo, writable: true, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  window.sessionStorage.clear();
  scrollTo.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
}

describe('save / read / clear', () => {
  it('save records the current window offset under the key; read returns it; clear drops it', () => {
    setScrollY(1234);
    saveReturnScroll(KEY);
    expect(readReturnScroll(KEY)?.y).toBe(1234);
    clearReturnScroll(KEY);
    expect(readReturnScroll(KEY)).toBeNull();
  });

  it('a malformed or negative stored entry reads as absent', () => {
    window.sessionStorage.setItem('return-scroll:' + KEY, 'not json');
    expect(readReturnScroll(KEY)).toBeNull();
    window.sessionStorage.setItem('return-scroll:' + KEY, JSON.stringify({ y: -5 }));
    expect(readReturnScroll(KEY)).toBeNull();
    window.sessionStorage.setItem('return-scroll:' + KEY, JSON.stringify({ y: 'far' }));
    expect(readReturnScroll(KEY)).toBeNull();
  });

  it('blocked storage is a silent no-op for every operation', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      },
    });
    expect(() => saveReturnScroll(KEY)).not.toThrow();
    expect(readReturnScroll(KEY)).toBeNull();
    expect(() => clearReturnScroll(KEY)).not.toThrow();
    if (original) Object.defineProperty(window, 'sessionStorage', original);
  });
});

describe('useReturnScroll — the restore contract', () => {
  it('restores once, instantly, when eligible and ready, then consumes the entry', () => {
    saveReturnScroll(KEY, 900);
    const { result, rerender } = renderHook(
      ({ ready }) => useReturnScroll({ key: KEY, eligible: true, ready }),
      { initialProps: { ready: false } },
    );
    expect(scrollTo).not.toHaveBeenCalled();
    rerender({ ready: true });
    expect(frames.size).toBe(1);
    flushFrames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 900, left: 0, behavior: 'instant' });
    expect(readReturnScroll(KEY)).toBeNull();
    // A later ready flip cannot restore again — the entry is consumed and the decision done.
    rerender({ ready: false });
    rerender({ ready: true });
    flushFrames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(typeof result.current.save).toBe('function');
  });

  it('a cold return (not eligible) discards the entry permanently; a later ready never restores', () => {
    saveReturnScroll(KEY, 900);
    const { rerender } = renderHook(
      ({ eligible, ready }) => useReturnScroll({ key: KEY, eligible, ready }),
      { initialProps: { eligible: false, ready: false } },
    );
    expect(readReturnScroll(KEY)).toBeNull();
    // Even if the caller wrongly flips eligible later, the decision is latched.
    rerender({ eligible: true, ready: true });
    flushFrames();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('never restores while not ready (an error surface or missing data keeps the page short)', () => {
    saveReturnScroll(KEY, 900);
    renderHook(() => useReturnScroll({ key: KEY, eligible: true, ready: false }));
    flushFrames();
    expect(scrollTo).not.toHaveBeenCalled();
    // The entry stays until the list is really displayed.
    expect(readReturnScroll(KEY)?.y).toBe(900);
  });

  it('unmounting before the frame runs cancels the restore and leaves nothing scheduled', () => {
    saveReturnScroll(KEY, 900);
    const { unmount } = renderHook(() => useReturnScroll({ key: KEY, eligible: true, ready: true }));
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    flushFrames();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('React Strict Mode double-invocation scrolls exactly once and consumes the entry once', () => {
    saveReturnScroll(KEY, 640);
    renderHook(() => useReturnScroll({ key: KEY, eligible: true, ready: true }), {
      wrapper: ({ children }) => React.createElement(React.StrictMode, null, children),
    });
    // Strict Mode ran the effect, cleaned it up (cancelling the frame), and ran it again.
    expect(frames.size).toBe(1);
    flushFrames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 640, left: 0, behavior: 'instant' });
    expect(readReturnScroll(KEY)).toBeNull();
  });

  it('a key change re-decides for the new key and never applies the old key\'s offset', () => {
    const OTHER = '/hall-library?workProjectType=Tunes';
    saveReturnScroll(KEY, 900);
    const { rerender } = renderHook(
      ({ key }) => useReturnScroll({ key, eligible: true, ready: true }),
      { initialProps: { key: OTHER } },
    );
    // OTHER has no entry: nothing scheduled.
    expect(frames.size).toBe(0);
    rerender({ key: KEY });
    expect(frames.size).toBe(1);
    flushFrames();
    expect(scrollTo).toHaveBeenCalledWith({ top: 900, left: 0, behavior: 'instant' });
  });

  it('save() from the hook records the current offset under the hook\'s key', () => {
    const { result } = renderHook(() => useReturnScroll({ key: KEY, eligible: false, ready: false }));
    setScrollY(2048);
    result.current.save();
    expect(readReturnScroll(KEY)?.y).toBe(2048);
  });

  it('no entry means nothing is scheduled and nothing is scrolled', () => {
    renderHook(() => useReturnScroll({ key: KEY, eligible: true, ready: true }));
    expect(frames.size).toBe(0);
    flushFrames();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
