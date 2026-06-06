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
import { useAuthState } from "./useAuthState.js";
import { getIdTokenClaims } from "../claims.js";
import type { AuthProviderConfig, AuthContextValue } from "./types.js";

 
export const AuthContext = createContext<AuthContextValue<any> | null>(null);

interface AuthProviderProps<TClaims> {
  config: AuthProviderConfig<TClaims>;
  children: ReactNode;
}

export function AuthProvider<TClaims = Record<string, unknown>>(
  { config, children }: AuthProviderProps<TClaims>,
) {
  const { user, loading: authLoading } = useAuthState(config.auth);

  const [claims, setClaims] = useState<TClaims>(config.defaultClaims);
  const [claimsLoading, setClaimsLoading] = useState(true);

  // Stable config ref so effects don't re-fire on config object identity changes
  const configRef = useRef(config);
  configRef.current = config;

  // --- Claims fetching ---
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setClaims(configRef.current.defaultClaims);
      setClaimsLoading(false);
      configRef.current.onAuthStateChange?.(null);
      return;
    }

    let cancelled = false;
    setClaimsLoading(true);
    configRef.current.onAuthStateChange?.(user);

    getIdTokenClaims(user)
      .then((raw) => {
        if (cancelled) return;
        setClaims(configRef.current.parseClaims((raw ?? {}) as Record<string, unknown>));
      })
      .catch((err) => {
        if (cancelled) return;
        configRef.current.onError?.(err, "getIdTokenClaims");
        setClaims(configRef.current.defaultClaims);
      })
      .finally(() => {
        if (!cancelled) setClaimsLoading(false);
      });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  // --- refreshClaims ---
  const refreshClaims = useCallback(async () => {
    if (!user) return;
    try {
      const result = await user.getIdTokenResult(true);
      setClaims(
        configRef.current.parseClaims((result.claims ?? {}) as Record<string, unknown>),
      );
    } catch (err) {
      configRef.current.onError?.(err, "refreshClaims");
    }
  }, [user]);

  // --- Context value ---
  const loading = authLoading || claimsLoading;

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
