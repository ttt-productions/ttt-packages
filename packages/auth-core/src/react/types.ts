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
