import { describe, it, expect, vi } from 'vitest';
import { resolveInfiniteDuration } from '../src/media-duration.js';

type FakeMediaElement = {
  duration: number;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};

function makeEl(duration: number, opts: { seekRevealsDuration?: number } = {}) {
  const listeners = new Set<() => void>();
  const el: FakeMediaElement = {
    duration,
    addEventListener: (type: string, fn: () => void) => {
      if (type === 'durationchange') listeners.add(fn);
    },
    removeEventListener: (_type: string, fn: () => void) => {
      listeners.delete(fn);
    },
  };
  const currentTimes: number[] = [];
  Object.defineProperty(el, 'currentTime', {
    set(v: number) {
      currentTimes.push(v);
      if (v > 0 && opts.seekRevealsDuration !== undefined) {
        el.duration = opts.seekRevealsDuration;
        queueMicrotask(() => {
          for (const fn of listeners) fn();
        });
      }
    },
    get() {
      return currentTimes[currentTimes.length - 1] ?? 0;
    },
  });
  return { el: el as HTMLMediaElement, currentTimes, listeners };
}

describe('resolveInfiniteDuration', () => {
  it('returns an already-finite duration without seeking', async () => {
    const { el, currentTimes } = makeEl(42);
    await expect(resolveInfiniteDuration(el)).resolves.toBe(42);
    expect(currentTimes).toEqual([]);
  });

  it('seeks past the end, learns the real duration, and restores currentTime to 0', async () => {
    const { el, currentTimes, listeners } = makeEl(Infinity, { seekRevealsDuration: 7 });
    await expect(resolveInfiniteDuration(el)).resolves.toBe(7);
    expect(currentTimes[0]).toBe(Number.MAX_SAFE_INTEGER);
    expect(currentTimes[currentTimes.length - 1]).toBe(0);
    expect(listeners.size).toBe(0);
  });

  it('resolves null when the duration never becomes finite within the timeout', async () => {
    vi.useFakeTimers();
    try {
      const { el, listeners } = makeEl(Infinity);
      const promise = resolveInfiniteDuration(el, 1_000);
      await vi.advanceTimersByTimeAsync(1_000);
      await expect(promise).resolves.toBeNull();
      expect(listeners.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles NaN duration the same as Infinity', async () => {
    const { el } = makeEl(NaN, { seekRevealsDuration: 3 });
    await expect(resolveInfiniteDuration(el)).resolves.toBe(3);
  });
});
