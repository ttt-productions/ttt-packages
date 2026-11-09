import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Auth } from 'firebase/auth';
import type { AuthState } from '../src/react/useAuthState.js';

const mockUseAuthState = vi.fn((_auth: Auth): AuthState => ({
  user: null,
  loading: false,
  error: null,
}));
vi.mock(import('../src/react/useAuthState.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    useAuthState: (auth) => mockUseAuthState(auth),
  });
});
vi.mock(import('../src/client/claims.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    getIdTokenClaims: vi.fn(async () => ({ role: 'member' })),
  });
});

import { AuthProvider } from '../src/react/AuthProvider.js';
import { useAuth } from '../src/react/useAuth.js';
import type { AuthProviderConfig } from '../src/react/types.js';
import { testAuth } from './helpers/test-auth.js';
import { testUser } from './helpers/test-user.js';

type Claims = Record<string, unknown>;

const config: AuthProviderConfig<Claims> = {
  auth: testAuth(() => null),
  parseClaims: (raw) => raw,
  defaultClaims: {},
};

function Wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider<Claims> config={config}>{children}</AuthProvider>;
}
Wrapper.displayName = 'RegistrationHoldTestWrapper';

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('the registration hold', () => {
  it('reports signed out, not loading, for the whole press while a session signs in under it', async () => {
    const newUser = testUser('uid-new');
    const press = deferred();
    const { result, rerender } = renderHook(() => useAuth<Claims>(), { wrapper: Wrapper });

    let held: Promise<string> | undefined;
    act(() => {
      held = result.current.holdRegistration(async () => {
        await press.promise;
        return 'done';
      });
    });
    expect(result.current.registering).toBe(true);

    mockUseAuthState.mockReturnValue({ user: newUser, loading: false, error: null });
    rerender();
    await waitFor(() => expect(result.current.registering).toBe(true));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.claims).toEqual({});

    mockUseAuthState.mockReturnValue({ user: newUser, loading: true, error: null });
    rerender();
    expect(result.current.loading).toBe(false);
    expect(result.current.authLoading).toBe(false);
    mockUseAuthState.mockReturnValue({ user: newUser, loading: false, error: null });
    rerender();

    await act(async () => {
      press.resolve();
      await held;
    });

    expect(result.current.registering).toBe(false);
    await waitFor(() => expect(result.current.user).toBe(newUser));
    await waitFor(() => expect(result.current.claims).toEqual({ role: 'member' }));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('ends when the press fails, and hands back the failure', async () => {
    mockUseAuthState.mockReturnValue({ user: null, loading: false, error: null });
    const { result } = renderHook(() => useAuth<Claims>(), { wrapper: Wrapper });
    const refusal = new Error('refused');

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current
        .holdRegistration(async () => {
          throw refusal;
        })
        .catch((error: unknown) => error);
    });

    expect(outcome).toBe(refusal);
    expect(result.current.registering).toBe(false);
  });

  it('holds until every begun hold has ended, each token ending only itself', () => {
    mockUseAuthState.mockReturnValue({ user: null, loading: false, error: null });
    const { result } = renderHook(() => useAuth<Claims>(), { wrapper: Wrapper });

    let first = 0;
    let second = 0;
    act(() => {
      first = result.current.beginRegistration();
      second = result.current.beginRegistration();
    });
    act(() => {
      result.current.endRegistration(first);
      result.current.endRegistration(first);
    });
    expect(result.current.registering).toBe(true);

    act(() => result.current.endRegistration(second));
    expect(result.current.registering).toBe(false);
  });
});
