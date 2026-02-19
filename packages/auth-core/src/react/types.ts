import type { Auth, User } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

/**
 * Base profile contract. Apps extend with their own fields.
 * auth-core uses these for monitoring integration and generic display.
 */
export interface BaseProfile {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  status?: string;
}

export interface AuthProviderConfig<
  TProfile extends BaseProfile = BaseProfile,
  TClaims = Record<string, unknown>,
> {
  auth: Auth;
  db: Firestore;

  /** Firestore path segments for profile doc: (uid) => ['users', uid] */
  profilePath: (uid: string) => [string, string];

  /** Transform raw Firestore data into app profile type */
  parseProfile?: (data: Record<string, unknown>, uid: string) => TProfile;

  /** Transform raw ID token claims into app claims shape */
  parseClaims: (raw: Record<string, unknown>) => TClaims;

  /** Default claims when no user or claims unavailable */
  defaultClaims: TClaims;

  /** Called on Firebase auth state change (for monitoring, analytics) */
  onAuthStateChange?: (user: User | null) => void;

  /** Called when profile snapshot updates (for monitoring, RQ cache bridge) */
  onProfileChange?: (profile: TProfile | null, user: User | null) => void;

  /** Called on errors (for Sentry) */
  onError?: (error: unknown, context: string) => void;

  /**
   * Max seconds to wait for profile doc after auth.
   * If exceeded, profileError is set and loading becomes false.
   * Default: 15
   */
  profileTimeout?: number;
}

export interface AuthContextValue<
  TProfile extends BaseProfile = BaseProfile,
  TClaims = Record<string, unknown>,
> {
  /** Firebase User */
  user: User | null;

  /** Firestore profile doc, parsed */
  userProfile: TProfile | null;

  /** Parsed custom claims */
  claims: TClaims;

  /** True until auth + claims + profile all resolved */
  loading: boolean;

  /** Individual loading states */
  authLoading: boolean;
  claimsLoading: boolean;
  profileLoading: boolean;

  /** Set when user is authenticated but profile doc not found within timeout */
  profileError: ProfileError | null;

  /** Convenience: !!user */
  isAuthenticated: boolean;

  /** Force refresh claims from Firebase */
  refreshClaims: () => Promise<void>;
}

export type ProfileError = {
  code: "PROFILE_NOT_FOUND" | "PROFILE_TIMEOUT" | "PROFILE_LISTENER_ERROR";
  message: string;
  uid: string;
};
