// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCallableMutation } from '../src/react/use-callable-mutation';
import { httpsCallable, type Functions } from 'firebase/functions';

const mockFunctions = {} as Functions;
const getFunctions = () => mockFunctions;

describe('useCallableMutation', () => {
  beforeEach(() => {
    vi.mocked(httpsCallable).mockReset();
  });

  it('returns callFunction and isLoading=false initially', () => {
    const { result } = renderHook(() =>
      useCallableMutation({ getFunctions }),
    );
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.callFunction).toBe('function');
  });

  it('returns data on success', async () => {
    const mockCallable = Object.assign(vi.fn().mockResolvedValue({ data: { ok: true } }), { stream: vi.fn() });
    vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

    const { result } = renderHook(() =>
      useCallableMutation({ getFunctions }),
    );

    let returned: unknown;
    await act(async () => {
      returned = await result.current.callFunction('myFn', { x: 1 });
    });

    expect(returned).toEqual({ ok: true });
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isLoading=true during the call', async () => {
    let resolveCall!: (v: { data: unknown }) => void;
    const mockCallable = Object.assign(
      vi.fn(() => new Promise<{ data: unknown }>((res) => { resolveCall = res; })),
      { stream: vi.fn() },
    );
    vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

    const { result } = renderHook(() =>
      useCallableMutation({ getFunctions }),
    );

    let callPromise: Promise<unknown>;
    act(() => {
      callPromise = result.current.callFunction('fn');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveCall({ data: null });
      await callPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('calls onError and re-throws on failure', async () => {
    const error = new Error('call failed');
    const mockCallable = Object.assign(vi.fn().mockRejectedValue(error), { stream: vi.fn() });
    vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useCallableMutation({ getFunctions, onError }),
    );

    await act(async () => {
      await expect(result.current.callFunction('failFn')).rejects.toThrow('call failed');
    });

    expect(onError).toHaveBeenCalledWith(error, expect.objectContaining({ functionName: 'failFn' }));
    expect(result.current.isLoading).toBe(false);
  });

  it('calls captureException on failure', async () => {
    const error = new Error('boom');
    const mockCallable = Object.assign(vi.fn().mockRejectedValue(error), { stream: vi.fn() });
    vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

    const captureException = vi.fn();
    const { result } = renderHook(() =>
      useCallableMutation({ getFunctions, captureException }),
    );

    await act(async () => {
      await expect(result.current.callFunction('fn')).rejects.toThrow();
    });

    expect(captureException).toHaveBeenCalledWith(error, expect.objectContaining({ functionName: 'fn' }));
  });

  it('throws when getFunctions returns null', async () => {
    const { result } = renderHook(() =>
      useCallableMutation({ getFunctions: () => null }),
    );

    await act(async () => {
      await expect(result.current.callFunction('fn')).rejects.toThrow(
        'Firebase Functions is not available',
      );
    });
  });

  it('threads timeoutMs through to the SDK timeout option', async () => {
    const mockCallable = Object.assign(vi.fn().mockResolvedValue({ data: { ok: true } }), { stream: vi.fn() });
    vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

    const { result } = renderHook(() =>
      useCallableMutation({ getFunctions, timeoutMs: 45_000 }),
    );

    await act(async () => {
      await result.current.callFunction('myFn', { x: 1 });
    });

    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(mockFunctions, 'myFn', { timeout: 45_000 });
  });

  // The hook constructs the transport object, so an option the primitive owns is
  // only reachable from React if this layer threads it. Default-false: an ordinary
  // hook call must produce no SDK options object at all.
  it('threads limitedUseAppCheck through to the SDK limitedUseAppCheckTokens option', async () => {
    const mockCallable = Object.assign(vi.fn().mockResolvedValue({ data: { ok: true } }), { stream: vi.fn() });
    vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

    const { result } = renderHook(() =>
      useCallableMutation({ getFunctions, limitedUseAppCheck: true }),
    );

    await act(async () => {
      await result.current.callFunction('sensitiveFn', { x: 1 });
    });

    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(mockFunctions, 'sensitiveFn', {
      limitedUseAppCheckTokens: true,
    });
  });

  it('omits limitedUseAppCheckTokens when the option is not enabled', async () => {
    const mockCallable = Object.assign(vi.fn().mockResolvedValue({ data: { ok: true } }), { stream: vi.fn() });
    vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

    const { result } = renderHook(() => useCallableMutation({ getFunctions }));
    await act(async () => {
      await result.current.callFunction('myFn', { x: 1 });
    });
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(mockFunctions, 'myFn', undefined);

    const withTimeout = renderHook(() => useCallableMutation({ getFunctions, timeoutMs: 45_000 }));
    await act(async () => {
      await withTimeout.result.current.callFunction('myFn', { x: 1 });
    });
    expect(vi.mocked(httpsCallable)).toHaveBeenLastCalledWith(mockFunctions, 'myFn', { timeout: 45_000 });
  });

  it('deadline expiry rejects with functions/deadline-exceeded and clears isLoading', async () => {
    vi.useFakeTimers();
    try {
      // Never-settling call models the SDK stuck anywhere, including the
      // pre-transport auth/App Check phase its own timer does not cover.
      const mockCallable = Object.assign(
        vi.fn(() => new Promise(() => {})),
        { stream: vi.fn() },
      );
      vi.mocked(httpsCallable).mockReturnValue(mockCallable as ReturnType<typeof httpsCallable>);

      const { result } = renderHook(() =>
        useCallableMutation({ getFunctions, timeoutMs: 1_000 }),
      );

      let call!: Promise<unknown>;
      act(() => {
        call = result.current.callFunction('hangs');
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        const assertion = expect(call).rejects.toMatchObject({
          name: 'FirebaseError',
          code: 'functions/deadline-exceeded',
        });
        await vi.advanceTimersByTimeAsync(1_000);
        await assertion;
      });

      expect(result.current.isLoading).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
