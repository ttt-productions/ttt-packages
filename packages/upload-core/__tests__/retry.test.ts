import { describe, it, expect, vi, afterEach } from 'vitest';
import { sleep, backoffDelayMs } from '../src/utils/retry';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('sleep', () => {
  it('resolves immediately for 0ms', async () => {
    await expect(sleep(0)).resolves.toBeUndefined();
  });

  it('resolves immediately for negative ms', async () => {
    await expect(sleep(-100)).resolves.toBeUndefined();
  });

  it('resolves after the specified delay (fake timers)', async () => {
    vi.useFakeTimers();
    const promise = sleep(1000);
    vi.advanceTimersByTime(1000);
    await expect(promise).resolves.toBeUndefined();
  });

  it('does not resolve before the delay completes', async () => {
    vi.useFakeTimers();
    let resolved = false;
    sleep(1000).then(() => { resolved = true; });
    vi.advanceTimersByTime(999);
    // Flush microtasks
    await Promise.resolve();
    expect(resolved).toBe(false);
    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it('rejects with AbortError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(10000, controller.signal)).rejects.toThrow();
    await expect(sleep(10000, controller.signal)).rejects.toSatisfy(
      (e: unknown) => (e as Error).name === 'AbortError'
    );
  });

  it('rejects with AbortError when signal is aborted during sleep', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const promise = sleep(10000, controller.signal);
    controller.abort();
    await expect(promise).rejects.toSatisfy(
      (e: unknown) => (e as Error).name === 'AbortError'
    );
  });

  it('resolves normally when no signal is provided', async () => {
    vi.useFakeTimers();
    const promise = sleep(500);
    vi.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
  });
});

describe('backoffDelayMs', () => {
  it('returns a value in range [base*0.75, base*1.25] for attempt 1', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(backoffDelayMs(1, 1000, 30000)).toBe(750);

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(backoffDelayMs(1, 1000, 30000)).toBe(1000);

    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(backoffDelayMs(1, 1000, 30000)).toBe(1250);
  });

  it('doubles the delay for attempt 2', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(backoffDelayMs(2, 1000, 30000)).toBe(1500);

    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(backoffDelayMs(2, 1000, 30000)).toBe(2500);
  });

  it('quadruples the delay for attempt 3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(backoffDelayMs(3, 1000, 30000)).toBe(3000);
  });

  it('caps result at maxDelayMs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const result = backoffDelayMs(10, 100, 500);
    expect(result).toBeLessThanOrEqual(500);
  });

  it('respects maxDelayMs with high attempt count', () => {
    for (let i = 0; i < 20; i++) {
      vi.spyOn(Math, 'random').mockReturnValue(Math.random());
      const result = backoffDelayMs(20, 100, 500);
      expect(result).toBeLessThanOrEqual(500);
    }
  });

  it('returns 0 for 0 base delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(backoffDelayMs(1, 0, 30000)).toBe(0);
  });

  it('returns a floor integer (no fractional ms)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const result = backoffDelayMs(1, 333, 30000);
    expect(Number.isInteger(result)).toBe(true);
  });
});
