import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

const mockUseAuthState = vi.fn(() => ({ user: null, loading: false }));
vi.mock('../src/react/useAuthState.js', () => ({
  useAuthState: (...args: unknown[]) => mockUseAuthState(...(args as [])),
}));
vi.mock('../src/claims.js', () => ({
  getIdTokenClaims: vi.fn(async () => ({})),
}));

import { AuthProvider } from '../src/react/AuthProvider.js';
import { useAuth } from '../src/react/useAuth.js';
import type { AuthProviderConfig } from '../src/react/types.js';

type Claims = Record<string, unknown>;

function makeConfig(overrides: Partial<AuthProviderConfig<Claims>> = {}): AuthProviderConfig<Claims> {
  return {
    auth: {} as never,
    parseClaims: (raw) => raw,
    defaultClaims: {},
    ...overrides,
  };
}

function makeWrapper(config: AuthProviderConfig<Claims>) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider<Claims> config={config}>{children}</AuthProvider>
  );
  Wrapper.displayName = 'ReadyGateTestWrapper';
  return Wrapper;
}

describe('AuthProvider readyGate', () => {
  it('without a gate, loading resolves as before (baseline unchanged)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(makeConfig()) });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('holds loading=true until the gate resolves, even after auth + claims settle', async () => {
    let openGate!: () => void;
    const gate = () =>
      new Promise<void>((resolve) => {
        openGate = resolve;
      });
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(makeConfig({ readyGate: gate })),
    });

    // Auth + claims are settled (mock resolves immediately), but the gate is closed.
    await waitFor(() => expect(result.current.authLoading).toBe(false));
    await waitFor(() => expect(result.current.claimsLoading).toBe(false));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      openGate();
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('FAILS OPEN on gate rejection: reports via onError("readyGate") and proceeds', async () => {
    const onError = vi.fn();
    const boom = new Error('attestation unavailable');
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(makeConfig({ readyGate: () => Promise.reject(boom), onError })),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onError).toHaveBeenCalledWith(boom, 'readyGate');
  });

  it('a synchronously-throwing gate also fails open', async () => {
    const onError = vi.fn();
    const gate = () => {
      throw new Error('sync boom');
    };
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(makeConfig({ readyGate: gate as unknown as () => Promise<unknown>, onError })),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'readyGate');
  });
});
