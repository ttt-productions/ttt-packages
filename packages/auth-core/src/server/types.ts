// Types for the createAssertAuth factory. Fully generic over the consuming
// app's user document shape. The package contains no app-specific knowledge.

import type { CallableRequest } from "firebase-functions/v2/https";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

/**
 * Per-callable requirements passed at every assertAuth call site.
 * These are application-agnostic.
 */
export interface AuthRequirements {
  /**
   * Allow unverified email. Default: false.
   * If true, the emailVerified check is skipped entirely.
   * Special-case for system flows (e.g. user registration).
   */
  allowUnverified?: boolean;

  /**
   * Require email_verified=true on the auth token.
   * Default: false. Skipped when allowUnverified=true.
   */
  emailVerified?: boolean;

  /**
   * Require user status is not 'banned' or 'disabled'.
   * Default: true (always enforced unless allowAnyStatus=true).
   */
  notBanned?: boolean;

  /**
   * Skip the not-banned check entirely. Special-case for flows where the
   * user doc may not exist yet (e.g. user registration).
   * Default: false.
   */
  allowAnyStatus?: boolean;

  /**
   * Allow banned users to pass the status check. Disabled users still fail.
   * Use ONLY for callables that are a banned user's last recourse
   * (e.g. admin-support chat).
   * Default: false. Does NOT skip the existence check.
   */
  allowBanned?: boolean;

  /**
   * Require admin status. Delegates to config.requireAdmin().
   * The shape of this object is forwarded verbatim to the consumer's
   * requireAdmin callback — the package does not interpret it.
   */
  admin?: AdminCheckOptions;
}

/**
 * Options forwarded to the consumer's requireAdmin callback. Generic shape.
 * Consuming apps may add their own fields; the package does not validate.
 */
export interface AdminCheckOptions {
  allowJrAdmin?: boolean;
  useFastCheck?: boolean;
  errorMessage?: string;
  [key: string]: unknown;
}

/**
 * Return value from assertAuth. Generic over the consuming app's user
 * document type.
 */
export interface AuthContext<TUser = unknown, TAdmin = void> {
  uid: string;
  token: DecodedIdToken;
  /** Populated when the user doc was read (default not-banned check). */
  userDoc?: TUser;
  /** Result returned by config.requireAdmin. Populated only when an admin check ran (AuthRequirements.admin was set). Undefined otherwise. */
  admin?: TAdmin;
}

/**
 * Status the consuming app reports for a user doc. The package only
 * interprets these three values.
 */
export type UserStatus = "ok" | "banned" | "disabled";

/**
 * Configuration for createAssertAuth. The consuming app supplies every
 * app-specific operation as a callback.
 */
export interface AssertAuthConfig<TUser, TAdmin = void> {
  /**
   * Returns the admin Firestore instance. Called every assertAuth invocation
   * that needs a Firestore read. Implementations typically return
   * `admin.firestore()` from a memoized handle.
   */
  firestore: () => Firestore;

  /**
   * Returns the Firestore document path for a user profile, given a uid.
   * Example: `userProfiles/${uid}`
   */
  userProfilePath: (uid: string) => string;

  /**
   * Returns the user's status given the user doc data. The package only
   * acts on 'ok' | 'banned' | 'disabled'. Apps may store status in any
   * field; this callback interprets it.
   */
  getUserStatus: (user: TUser) => UserStatus;

  /**
   * Admin check. Called only when AuthRequirements.admin is set. The
   * package forwards uid, token, and the admin options verbatim. The
   * callback throws (typically HttpsError) on failure.
   */
  requireAdmin: (
    uid: string,
    token: DecodedIdToken,
    options: AdminCheckOptions
  ) => Promise<TAdmin>;
}

/**
 * The function returned by createAssertAuth.
 */
export type AssertAuthFn<TUser, TAdmin = void> = (
  request: CallableRequest,
  requirements?: AuthRequirements
) => Promise<AuthContext<TUser, TAdmin>>;
