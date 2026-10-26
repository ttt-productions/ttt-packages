import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { IdTokenResult, User } from 'firebase/auth';
import type { IdTokenClaims } from '../src/client/claims.js';

type Claims = { owner: string };

let currentUser: User | null = null;
vi.mock(import('../src/react/useAuthState.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    useAuthState: () => ({ user: currentUser, loading: false, error: null }),
  });
});

const pendingInitialReads = new Map<string, Array<(claims: IdTokenClaims) => void>>();
vi.mock(import('../src/client/claims.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    getIdTokenClaims: vi.fn(async (user: User | null) => {
      if (!user) return null;
      return new Promise<IdTokenClaims>((resolve) => {
        const list = pendingInitialReads.get(user.uid) ?? [];
        list.push(resolve);
        pendingInitialReads.set(user.uid, list);
      });
    }),
  });
});

import { AuthProvider } from '../src/react/AuthProvider.js';
import { useAuth } from '../src/react/useAuth.js';
import { testAuth } from './helpers/test-auth.js';
import { idTokenResult, testUser } from './helpers/test-user.js';

function makeUser(uid: string) {
  const refreshes: Array<(claims: Record<string, unknown>) => void> = [];
  const user = testUser(uid, {
    getIdTokenResult: vi.fn(
      () =>
        new Promise<IdTokenResult>((resolve) => {
          refreshes.push((claims) => resolve(idTokenResult(claims)));
        }),
    ),
  });
  return { user, refreshes };
}

function resolveInitialRead(uid: string, owner: string) {
  const next = pendingInitialReads.get(uid)?.shift();
  if (!next) throw new Error(`no pending initial read for ${uid}`);
  next({ owner });
}

const liveAuth = testAuth(() => currentUser);

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider<Claims>
    config={{
      auth: liveAuth,
      parseClaims: (raw) => ({ owner: String(raw.owner ?? '') }),
      defaultClaims: { owner: '' },
    }}
  >
    {children}
  </AuthProvider>
);
wrapper.displayName = 'ClaimsTestWrapper';

beforeEach(() => {
  currentUser = null;
  pendingInitialReads.clear();
});

describe('AuthProvider claims belong to the current session', () => {
  it('a refresh that settles after an account switch never lands on the next account', async () => {
    const a = makeUser('uid-a');
    const b = makeUser('uid-b');
    currentUser = a.user;
    const { result, rerender } = renderHook(() => useAuth<Claims>(), { wrapper });
    await act(async () => resolveInitialRead('uid-a', 'A'));
    await waitFor(() => expect(result.current.claims.owner).toBe('A'));

    let refreshDone!: Promise<void>;
    act(() => {
      refreshDone = result.current.refreshClaims();
    });

    currentUser = b.user;
    rerender();
    await act(async () => resolveInitialRead('uid-b', 'B'));
    await waitFor(() => expect(result.current.claims.owner).toBe('B'));

    await act(async () => {
      a.refreshes[0]({ owner: 'A' });
      await refreshDone;
    });

    expect(result.current.user).toBe(b.user);
    expect(result.current.claims.owner).toBe('B');
  });

  it('a refreshClaims taken before sign-in refreshes the account signed in when it is called', async () => {
    const { result, rerender } = renderHook(() => useAuth<Claims>(), { wrapper });
    const refreshFromSignedOutRender = result.current.refreshClaims;

    const created = makeUser('uid-new');
    currentUser = created.user;
    rerender();
    await act(async () => resolveInitialRead('uid-new', 'pre-claim'));
    await waitFor(() => expect(result.current.claims.owner).toBe('pre-claim'));

    let refreshDone!: Promise<void>;
    act(() => {
      refreshDone = refreshFromSignedOutRender();
    });
    expect(created.user.getIdTokenResult).toHaveBeenCalledWith(true);
    await act(async () => {
      created.refreshes[0]({ owner: 'member' });
      await refreshDone;
    });

    expect(result.current.claims.owner).toBe('member');
  });

  it('the first render after a direct switch shows no claims and is loading, never the previous account', async () => {
    const a = makeUser('uid-a');
    const b = makeUser('uid-b');
    currentUser = a.user;
    const { result, rerender } = renderHook(() => useAuth<Claims>(), { wrapper });
    await act(async () => resolveInitialRead('uid-a', 'A'));
    await waitFor(() => expect(result.current.claims.owner).toBe('A'));

    currentUser = b.user;
    rerender();

    expect(result.current.user).toBe(b.user);
    expect(result.current.claims.owner).toBe('');
    expect(result.current.claimsLoading).toBe(true);
    expect(result.current.loading).toBe(true);
  });

  it('an initial read that settles after a switch is dropped', async () => {
    const a = makeUser('uid-a');
    const b = makeUser('uid-b');
    currentUser = a.user;
    const { result, rerender } = renderHook(() => useAuth<Claims>(), { wrapper });

    currentUser = b.user;
    rerender();
    await act(async () => resolveInitialRead('uid-a', 'A'));

    expect(result.current.claims.owner).toBe('');
    expect(result.current.claimsLoading).toBe(true);

    await act(async () => resolveInitialRead('uid-b', 'B'));
    await waitFor(() => expect(result.current.claims.owner).toBe('B'));
  });

  it('a refresh that settles after sign-out leaves the signed-out default claims', async () => {
    const a = makeUser('uid-a');
    currentUser = a.user;
    const { result, rerender } = renderHook(() => useAuth<Claims>(), { wrapper });
    await act(async () => resolveInitialRead('uid-a', 'A'));
    await waitFor(() => expect(result.current.claims.owner).toBe('A'));

    let refreshDone!: Promise<void>;
    act(() => {
      refreshDone = result.current.refreshClaims();
    });
    currentUser = null;
    rerender();
    await act(async () => {
      a.refreshes[0]({ owner: 'A' });
      await refreshDone;
    });

    expect(result.current.user).toBeNull();
    expect(result.current.claims.owner).toBe('');
    expect(result.current.claimsLoading).toBe(false);
  });

  it('an older read that settles after a newer one is dropped', async () => {
    const a = makeUser('uid-a');
    currentUser = a.user;
    const { result } = renderHook(() => useAuth<Claims>(), { wrapper });

    let refreshDone!: Promise<void>;
    act(() => {
      refreshDone = result.current.refreshClaims();
    });
    await act(async () => {
      a.refreshes[0]({ owner: 'fresh' });
      await refreshDone;
    });
    await waitFor(() => expect(result.current.claims.owner).toBe('fresh'));

    await act(async () => resolveInitialRead('uid-a', 'stale'));

    expect(result.current.claims.owner).toBe('fresh');
  });

  it('signing the same uid back in reads its claims again instead of reusing the old session', async () => {
    const first = makeUser('uid-a');
    currentUser = first.user;
    const { result, rerender } = renderHook(() => useAuth<Claims>(), { wrapper });
    await act(async () => resolveInitialRead('uid-a', 'before'));
    await waitFor(() => expect(result.current.claims.owner).toBe('before'));

    const second = makeUser('uid-a');
    currentUser = second.user;
    rerender();

    expect(result.current.claims.owner).toBe('');
    expect(result.current.claimsLoading).toBe(true);
    await act(async () => resolveInitialRead('uid-a', 'after'));
    await waitFor(() => expect(result.current.claims.owner).toBe('after'));
  });
});
