// packages/auth-core/src/server/types.ts
//
// Types for the createAssertAuth factory. Fully generic over the consuming
// app's user and project document shapes. The package contains no
// app-specific knowledge.

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
   * Require the user has creator status (config.isUserCreator(user) returns true).
   * Default: false. Implies a Firestore read of the user doc.
   */
  creator?: boolean;

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
   * Require the caller is allowed to perform a project action.
   * Owner access is implicit in the consuming app's isProjectActionAllowed callback.
   * Baseline member reads should use an app-defined action such as `project.read`.
   */
  projectMembership?: {
    projectId: string;
    action: string;
  };

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
 * Return value from assertAuth. Generic over the consuming app's user and
 * project document types.
 */
export interface AuthContext<TUser = unknown, TProject = unknown> {
  uid: string;
  token: DecodedIdToken;
  /** Populated when the user doc was read (creator OR default not-banned check). */
  userDoc?: TUser;
  /** Populated when projectMembership was checked. */
  project?: {
    data: TProject;
    isOwner: boolean;
    isMember: boolean;
  };
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
export interface AssertAuthConfig<TUser, TProject> {
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
   * Returns the Firestore document path for a project, given a projectId.
   * Example: `allProjects/${projectId}`
   */
  projectPath: (projectId: string) => string;

  /**
   * Returns the user's status given the user doc data. The package only
   * acts on 'ok' | 'banned' | 'disabled'. Apps may store status in any
   * field; this callback interprets it.
   */
  getUserStatus: (user: TUser) => UserStatus;

  /**
   * Returns true if the user is a creator. Called only when
   * AuthRequirements.creator === true.
   */
  isUserCreator: (user: TUser) => boolean;

  /**
   * Returns true if the given uid is the owner of the project.
   */
  isProjectOwner: (project: TProject, uid: string) => boolean;

  /**
   * Returns true if the given uid is a member of the project. Owners are
   * typically also members — the callback should reflect that.
   */
  isProjectMember: (project: TProject, uid: string) => boolean;

  /**
   * Returns true if the caller may perform a project action. Apps can perform
   * async reads here, such as loading allProjects/{projectId}/members/{uid}.
   */
  isProjectActionAllowed: (args: {
    project: TProject;
    projectId: string;
    uid: string;
    action: string;
  }) => Promise<boolean>;

  /**
   * Admin check. Called only when AuthRequirements.admin is set. The
   * package forwards uid, token, and the admin options verbatim. The
   * callback throws (typically HttpsError) on failure.
   */
  requireAdmin: (
    uid: string,
    token: DecodedIdToken,
    options: AdminCheckOptions
  ) => Promise<void>;
}

/**
 * The function returned by createAssertAuth.
 */
export type AssertAuthFn<TUser, TProject> = (
  request: CallableRequest,
  requirements?: AuthRequirements
) => Promise<AuthContext<TUser, TProject>>;
