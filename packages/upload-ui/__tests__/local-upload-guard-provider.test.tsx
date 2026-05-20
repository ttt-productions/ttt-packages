import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  LocalUploadGuardProvider,
  useLocalUploadGuard,
} from '../src/react/local-upload-guard-provider.js';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(LocalUploadGuardProvider, null, children);
}

let addSpy: ReturnType<typeof vi.spyOn>;
let removeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  addSpy = vi.spyOn(window, 'addEventListener');
  removeSpy = vi.spyOn(window, 'removeEventListener');
});

afterEach(() => {
  addSpy.mockRestore();
  removeSpy.mockRestore();
});

describe('LocalUploadGuardProvider', () => {
  it('activeUploadCount starts at 0', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    expect(result.current.activeUploadCount).toBe(0);
    const beforeunloadCalls = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
    expect(beforeunloadCalls).toHaveLength(0);
  });

  it('registerUpload increments the count', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('a'));
    expect(result.current.activeUploadCount).toBe(1);
    act(() => result.current.registerUpload('b'));
    expect(result.current.activeUploadCount).toBe(2);
  });

  it('registering the same id twice is a no-op', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('a'));
    act(() => result.current.registerUpload('a'));
    expect(result.current.activeUploadCount).toBe(1);
  });

  it('unregisterUpload decrements the count when the id is present', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('a'));
    act(() => result.current.registerUpload('b'));
    act(() => result.current.unregisterUpload('a'));
    expect(result.current.activeUploadCount).toBe(1);
    act(() => result.current.unregisterUpload('b'));
    expect(result.current.activeUploadCount).toBe(0);
  });

  it('unregistering an id that was never registered is a no-op', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('a'));
    act(() => result.current.unregisterUpload('never-registered'));
    expect(result.current.activeUploadCount).toBe(1);
  });

  it('adds a beforeunload listener when count goes from 0 to 1', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    const beforeBefore = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
    expect(beforeBefore).toHaveLength(0);

    act(() => result.current.registerUpload('a'));

    const afterBefore = addSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
    expect(afterBefore).toHaveLength(1);
  });

  it('removes the beforeunload listener when count returns to 0', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('a'));

    const addedCall = addSpy.mock.calls.find((c) => c[0] === 'beforeunload');
    const addedHandler = addedCall![1];

    act(() => result.current.unregisterUpload('a'));

    const removedCalls = removeSpy.mock.calls.filter((c) => c[0] === 'beforeunload');
    expect(removedCalls.length).toBeGreaterThanOrEqual(1);
    const removedHandler = removedCalls[removedCalls.length - 1]![1];
    expect(removedHandler).toBe(addedHandler);
  });

  it('the beforeunload handler calls preventDefault and sets returnValue', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('a'));

    const addedCall = addSpy.mock.calls.find((c) => c[0] === 'beforeunload');
    const handler = addedCall![1] as (e: BeforeUnloadEvent) => void;

    const event = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent;
    handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(typeof event.returnValue).toBe('string');
    expect(event.returnValue.length).toBeGreaterThan(0);
    expect(event.returnValue.toLowerCase()).toContain('upload');
  });

  it('useLocalUploadGuard throws outside a provider', () => {
    let caughtError: unknown;
    try {
      renderHook(() => useLocalUploadGuard());
    } catch (e) {
      caughtError = e;
    }
    expect((caughtError as Error)?.message).toMatch(
      /must be used within LocalUploadGuardProvider/i,
    );
  });

  it('shouldConfirmNavigation returns false when no uploads are active', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    expect(result.current.shouldConfirmNavigation()).toBe(false);
  });

  it('shouldConfirmNavigation returns true when at least one upload is registered', () => {
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('u1'));
    expect(result.current.shouldConfirmNavigation()).toBe(true);
  });

  it('confirmNavigation returns true without prompting when no uploads are active', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    expect(result.current.confirmNavigation()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('confirmNavigation prompts when uploads are active and returns the user choice', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => useLocalUploadGuard(), { wrapper });
    act(() => result.current.registerUpload('u1'));
    expect(result.current.confirmNavigation()).toBe(true);
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockReturnValue(false);
    expect(result.current.confirmNavigation()).toBe(false);
    confirmSpy.mockRestore();
  });
});
