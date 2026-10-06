"use client";

import {
  createContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { useAuthState } from "./useAuthState.js";
import { getIdTokenClaims } from "../claims.js";
import type { AuthProviderConfig, AuthContextValue } from "./types.js";

/**
 * Claims resolved for one signed-in session. `user` is the Firebase `User` instance (it carries
 * the uid and is replaced on every sign-in), and `generation` orders the reads that produced it.
 */
interface ResolvedClaims<TClaims> {
  user: User;
  generation: number;
  claims: TClaims;
}

 
export const AuthContext = createContext<AuthContextValue<any> | null>(null);

interface AuthProviderProps<TClaims> {
  config: AuthProviderConfig<TClaims>;
  children: ReactNode;
}

export function AuthProvider<TClaims = Record<string, unknown>>(
  { config, children }: AuthProviderProps<TClaims>,
) {
  const { user, loading: authLoading } = useAuthState(config.auth);

  // Claims are held with the session they were read for and derived at render (below), so a
  // render can never pair one account's `user` with another account's claims, and a read that
  // settles after the session changed (a late refresh, a slow initial read) is dropped.
  const [resolved, setResolved] = useState<ResolvedClaims<TClaims> | null>(null);
  const generationRef = useRef(0);
  const appliedGenerationRef = useRef(0);
  const currentUserRef = useRef<User | null>(user);
  currentUserRef.current = user;

  // Stable config ref so effects don't re-fire on config object identity changes
  const configRef = useRef(config);
  configRef.current = config;

  /**
   * Read `forUser`'s claims under a new generation and apply them only if `forUser` is still
   * the signed-in session and no newer read has applied. A failed read leaves the session's
   * claims as they are, or settles an unread session on the default claims.
   */
  const readClaims = useCallback(
    async (forUser: User, read: () => Promise<Record<string, unknown> | null>, context: string) => {
      const generation = ++generationRef.current;
      try {
        const raw = await read();
        if (currentUserRef.current !== forUser || generation <= appliedGenerationRef.current) return;
        appliedGenerationRef.current = generation;
        setResolved({ user: forUser, generation, claims: configRef.current.parseClaims(raw ?? {}) });
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

  // --- Optional readiness gate (see AuthProviderConfig.readyGate) ---
  // Open immediately when no gate is configured; otherwise held closed until the
  // gate settles. Fail-open: a rejected gate is reported and then treated as open.
  const [gateOpen, setGateOpen] = useState(() => !config.readyGate);
  useEffect(() => {
    const gate = configRef.current.readyGate;
    if (!gate) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => gate())
      .catch((err) => configRef.current.onError?.(err, "readyGate"))
      .finally(() => {
        if (!cancelled) setGateOpen(true);
      });
    return () => { cancelled = true; };
    // Mount-only by design (reads only the stable configRef): the gate is a
    // one-time client readiness signal.
  }, []);

  // --- Claims fetching ---
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
      "getIdTokenClaims",
    );
  }, [user, authLoading, readClaims]);

  // --- refreshClaims ---
  const refreshClaims = useCallback(async () => {
    // The LIVE signed-in user, never the one this render saw: a caller can hold this callback from
    // before its own sign-in (a registration's submit handler creates the account and then asks for
    // the claims the server just set), and a refresh of that render's `null` user would do nothing —
    // leaving the new account on its pre-claim token until the hourly refresh.
    const liveUser = configRef.current.auth.currentUser;
    if (!liveUser) return;
    await readClaims(
      liveUser,
      async () => ((await liveUser.getIdTokenResult(true)).claims ?? {}) as Record<string, unknown>,
      "refreshClaims",
    );
  }, [readClaims]);

  // --- Derived at render: only the current session's claims are ever exposed ---
  const sessionClaims = user && resolved?.user === user ? resolved : null;
  const claims = sessionClaims ? sessionClaims.claims : config.defaultClaims;
  const claimsLoading = authLoading || (user !== null && sessionClaims === null);

  // --- Context value ---
  const loading = authLoading || claimsLoading || !gateOpen;

  const value = useMemo<AuthContextValue<TClaims>>(
    () => ({
      user,
      claims,
      loading,
      authLoading,
      claimsLoading,
      isAuthenticated: !!user,
      refreshClaims,
    }),
    [user, claims, loading, authLoading, claimsLoading, refreshClaims],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
