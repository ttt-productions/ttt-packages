import type { Auth, User } from "firebase/auth";

export interface AuthProviderConfig<TClaims = Record<string, unknown>> {
  auth: Auth;

  /** Transform raw ID token claims into app claims shape */
  parseClaims: (raw: Record<string, unknown>) => TClaims;

  /** Default claims when no user or claims unavailable */
  defaultClaims: TClaims;

  /** Called on Firebase auth state change (for monitoring, analytics) */
  onAuthStateChange?: (user: User | null) => void;

  /** Called on errors (for Sentry) */
  onError?: (error: unknown, context: string) => void;

  /**
   * Optional readiness gate awaited before the provider reports `loading: false`.
   * Use when data consumers keyed on `user` must not mount until some async
   * client readiness completes first — e.g. an App Check / attestation token,
   * without which every data subscription opened at mount is rejected once and
   * dies. The gate FAILS OPEN: a rejection is reported via `onError('readyGate')`
   * and the provider proceeds, so a broken gate degrades to today's behavior
   * rather than bricking the app. Called once on mount (client only).
   */
  readyGate?: () => Promise<unknown>;
}

export interface AuthContextValue<TClaims = Record<string, unknown>> {
  /** Firebase User */
  user: User | null;

  /** Parsed custom claims */
  claims: TClaims;

  /** True until auth + claims resolved */
  loading: boolean;

  /** Individual loading states */
  authLoading: boolean;
  claimsLoading: boolean;

  /** Convenience: !!user */
  isAuthenticated: boolean;

  /** Force refresh claims from Firebase */
  refreshClaims: () => Promise<void>;
}
