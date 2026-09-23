import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAsyncAction } from '../src/react/hooks/use-async-action';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAsyncAction', () => {
  it('is pending from run() until the action settles', async () => {
    const gate = deferred();
    const { result } = renderHook(() => useAsyncAction(() => gate.promise, { onError: vi.fn() }));
    expect(result.current.pending).toBe(false);

    let run!: Promise<boolean>;
    act(() => {
      run = result.current.run();
    });
    expect(result.current.pending).toBe(true);

    await act(async () => {
      gate.resolve();
      await run;
    });
    expect(result.current.pending).toBe(false);
    await expect(run).resolves.toBe(true);
  });

  it('ignores a repeat call while the first is still in flight', async () => {
    const gate = deferred();
    const action = vi.fn(() => gate.promise);
    const { result } = renderHook(() => useAsyncAction(action, { onError: vi.fn() }));

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.run();
      second = result.current.run();
    });
    await expect(second).resolves.toBe(false);
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve();
      await first;
    });
    await expect(first).resolves.toBe(true);
  });

  it('routes a thrown error to onError, never rejects, and clears pending', async () => {
    const onError = vi.fn();
    const boom = new Error('boom');
    const { result } = renderHook(() => useAsyncAction(() => Promise.reject(boom), { onError }));

    let run!: Promise<boolean>;
    await act(async () => {
      run = result.current.run();
      await run;
    });
    await expect(run).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith(boom);
    expect(result.current.pending).toBe(false);
  });

  it('passes run() arguments through and calls the LATEST action and onError', async () => {
    const first = vi.fn(async (_id: string) => {});
    const second = vi.fn(async (_id: string) => {});
    const { result, rerender } = renderHook(
      ({ action }) => useAsyncAction(action, { onError: vi.fn() }),
      { initialProps: { action: first } },
    );
    rerender({ action: second });
    await act(async () => {
      await result.current.run('row-7');
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('row-7');
  });

  it('keeps run referentially stable across renders', () => {
    const { result, rerender } = renderHook(
      ({ n }) => useAsyncAction(async () => n, { onError: vi.fn() }),
      { initialProps: { n: 1 } },
    );
    const firstRun = result.current.run;
    rerender({ n: 2 });
    expect(result.current.run).toBe(firstRun);
  });
});
