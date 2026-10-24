'use client';

import {
  createContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import { useAuthState } from './useAuthState.js';
import { getIdTokenClaims } from '../client/claims.js';
import type { AuthProviderConfig, AuthContextValue } from './types.js';

interface ResolvedClaims<TClaims> {
  user: User;
  generation: number;
  claims: TClaims;
}

export const AuthContext = createContext<AuthContextValue<unknown> | null>(null);

interface AuthProviderProps<TClaims> {
  config: AuthProviderConfig<TClaims>;
  children: ReactNode;
}

export function AuthProvider<TClaims = Record<string, unknown>>({
  config,
  children,
}: AuthProviderProps<TClaims>) {
  const { user, loading: authLoading } = useAuthState(config.auth);

  const [resolved, setResolved] = useState<ResolvedClaims<TClaims> | null>(null);
  const generationRef = useRef(0);
  const appliedGenerationRef = useRef(0);
  const currentUserRef = useRef<User | null>(user);
  currentUserRef.current = user;

  const configRef = useRef(config);
  configRef.current = config;

  const readClaims = useCallback(
    async (forUser: User, read: () => Promise<Record<string, unknown> | null>, context: string) => {
      const generation = ++generationRef.current;
      try {
        const raw = await read();
        if (currentUserRef.current !== forUser || generation <= appliedGenerationRef.current)
          return;
        appliedGenerationRef.current = generation;
        setResolved({
          user: forUser,
          generation,
          claims: configRef.current.parseClaims(raw ?? {}),
        });
      } catch (err) {
        if (currentUserRef.current !== forUser) return;
        configRef.current.onError?.(err, context);
        setResolved((prev) =>
          prev && prev.user === forUser
            ? prev
            : { user: forUser, generation, claims: configRef.current.defaultClaims },
        );
      }
    },
    [],
  );

  const [gateOpen, setGateOpen] = useState(() => !config.readyGate);
  useEffect(() => {
    const gate = configRef.current.readyGate;
    if (!gate) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => gate())
      .catch((err) => configRef.current.onError?.(err, 'readyGate'))
      .finally(() => {
        if (!cancelled) setGateOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setResolved(null);
      configRef.current.onAuthStateChange?.(null);
      return;
    }

    configRef.current.onAuthStateChange?.(user);
    void readClaims(
      user,
      async () => ((await getIdTokenClaims(user)) ?? {}) as Record<string, unknown>,
      'getIdTokenClaims',
    );
  }, [user, authLoading, readClaims]);

  const refreshClaims = useCallback(async () => {
    // `auth.currentUser`, not this render's user: a caller can hold this callback from before its own sign-in.
    const liveUser = configRef.current.auth.currentUser;
    if (!liveUser) return;
    await readClaims(
      liveUser,
      async () => ((await liveUser.getIdTokenResult(true)).claims ?? {}) as Record<string, unknown>,
      'refreshClaims',
    );
  }, [readClaims]);

  const sessionClaims = user && resolved?.user === user ? resolved : null;
  const claimsLoading = authLoading || (user !== null && sessionClaims === null);

  const exposedUser = gateOpen ? user : null;
  const claims = exposedUser && sessionClaims ? sessionClaims.claims : config.defaultClaims;

  const loading = authLoading || claimsLoading || !gateOpen;

  const value = useMemo<AuthContextValue<TClaims>>(
    () => ({
      user: exposedUser,
      claims,
      loading,
      authLoading,
      claimsLoading,
      isAuthenticated: !!exposedUser,
      refreshClaims,
    }),
    [exposedUser, claims, loading, authLoading, claimsLoading, refreshClaims],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
