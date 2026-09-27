import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';

type Claims = { owner: string };

let currentUser: User | null = null;
vi.mock('../src/react/useAuthState.js', () => ({
  useAuthState: () => ({ user: currentUser, loading: false, error: null }),
}));

const pendingInitialReads = new Map<string, Array<(claims: Record<string, unknown>) => void>>();
vi.mock('../src/claims.js', () => ({
  getIdTokenClaims: vi.fn(
    (user: User) =>
      new Promise((resolve) => {
        const list = pendingInitialReads.get(user.uid) ?? [];
        list.push(resolve as (claims: Record<string, unknown>) => void);
        pendingInitialReads.set(user.uid, list);
      }),
  ),
}));

import { AuthProvider } from '../src/react/AuthProvider.js';
import { useAuth } from '../src/react/useAuth.js';

/** A signed-in session whose forced refreshes resolve only when the test says so. */
function makeUser(uid: string) {
  const refreshes: Array<(claims: Record<string, unknown>) => void> = [];
  const user = {
    uid,
    getIdTokenResult: vi.fn(
      () =>
        new Promise((resolve) => {
          refreshes.push((claims) => resolve({ claims }));
        }),
    ),
  } as unknown as User;
  return { user, refreshes };
}

function resolveInitialRead(uid: string, owner: string) {
  const next = pendingInitialReads.get(uid)?.shift();
  if (!next) throw new Error(`no pending initial read for ${uid}`);
  next({ owner });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider<Claims>
    config={{ auth: {} as never, parseClaims: (raw) => ({ owner: String(raw.owner ?? '') }), defaultClaims: { owner: '' } }}
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
