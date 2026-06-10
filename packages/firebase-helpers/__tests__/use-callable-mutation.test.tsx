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
});
