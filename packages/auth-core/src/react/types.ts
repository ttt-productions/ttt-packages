import type { Auth, User } from 'firebase/auth';

export interface AuthProviderConfig<TClaims = Record<string, unknown>> {
  auth: Auth;

  parseClaims: (raw: Record<string, unknown>) => TClaims;

  defaultClaims: TClaims;

  onAuthStateChange?: (user: User | null) => void;

  onError?: (error: unknown, context: string) => void;

  readyGate?: () => Promise<unknown>;
}

export interface AuthContextValue<TClaims = Record<string, unknown>> {
  user: User | null;

  claims: TClaims;

  loading: boolean;

  authLoading: boolean;
  claimsLoading: boolean;

  isAuthenticated: boolean;

  refreshClaims: () => Promise<void>;
}
