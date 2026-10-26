import { afterEach, describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Auth } from 'firebase/auth';
import type { AuthState } from '../src/react/useAuthState.js';

const mockUseAuthState = vi.fn((_auth: Auth): AuthState => ({
  user: null,
  loading: false,
  error: null,
}));
vi.mock('../src/react/useAuthState.js', async () => {
  const { stubModule } = await import('../../../test/typed-mock.js');
  return stubModule<typeof import('../src/react/useAuthState.js')>({
    useAuthState: (auth) => mockUseAuthState(auth),
  });
});
vi.mock('../src/client/claims.js', async () => {
  const { stubModule } = await import('../../../test/typed-mock.js');
  return stubModule<typeof import('../src/client/claims.js')>({
    getIdTokenClaims: vi.fn(async () => ({})),
  });
});

import { AuthProvider } from '../src/react/AuthProvider.js';
import { useAuth } from '../src/react/useAuth.js';
import type { AuthProviderConfig } from '../src/react/types.js';
import { testAuth } from './helpers/test-auth.js';
import { testUser } from './helpers/test-user.js';

type Claims = Record<string, unknown>;

function makeConfig(
  overrides: Partial<AuthProviderConfig<Claims>> = {},
): AuthProviderConfig<Claims> {
  return {
    auth: testAuth(() => null),
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
  it('without a gate, loading resolves once auth and claims settle', async () => {
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

  describe('a restored session while the gate is closed', () => {
    const restoredUser = testUser('restored-uid');

    afterEach(() => {
      mockUseAuthState.mockReturnValue({ user: null, loading: false, error: null });
    });

    function deferredGate() {
      let settle!: { open: () => void; fail: (err: unknown) => void };
      const gate = () =>
        new Promise<void>((resolve, reject) => {
          settle = { open: resolve, fail: reject };
        });
      return { gate, settle: () => settle };
    }

    it('exposes no user, no authentication and the default claims until the gate opens', async () => {
      mockUseAuthState.mockReturnValue({ user: restoredUser, loading: false, error: null });
      const { gate, settle } = deferredGate();
      const { result } = renderHook(() => useAuth(), {
        wrapper: makeWrapper(
          makeConfig({
            readyGate: gate,
            parseClaims: () => ({ admin: true }),
            defaultClaims: { admin: false },
          }),
        ),
      });

      await waitFor(() => expect(result.current.claimsLoading).toBe(false));
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.claims).toEqual({ admin: false });
      expect(result.current.loading).toBe(true);

      await act(async () => {
        settle().open();
      });
      await waitFor(() => expect(result.current.user).toBe(restoredUser));
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.claims).toEqual({ admin: true });
      expect(result.current.loading).toBe(false);
    });

    it('exposes the user once a rejected gate fails open, never before', async () => {
      mockUseAuthState.mockReturnValue({ user: restoredUser, loading: false, error: null });
      const { gate, settle } = deferredGate();
      const { result } = renderHook(() => useAuth(), {
        wrapper: makeWrapper(makeConfig({ readyGate: gate, onError: vi.fn() })),
      });

      await waitFor(() => expect(result.current.claimsLoading).toBe(false));
      expect(result.current.user).toBeNull();

      await act(async () => {
        settle().fail(new Error('attestation unavailable'));
      });
      await waitFor(() => expect(result.current.user).toBe(restoredUser));
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('a synchronously-throwing gate also fails open', async () => {
    const onError = vi.fn();
    const gate = (): Promise<void> => {
      throw new Error('sync boom');
    };
    const { result } = renderHook(() => useAuth(), {
      wrapper: makeWrapper(makeConfig({ readyGate: gate, onError })),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'readyGate');
  });
});
