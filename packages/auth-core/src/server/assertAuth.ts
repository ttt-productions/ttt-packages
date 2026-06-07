// Factory that produces an assertAuth function bound to a consuming app's
// Firestore paths, user shape, and admin check.
//
// Every Cloud Functions callable in the consuming app should invoke the
// returned assertAuth as its first executable line. The check order is:
//   1. Authentication
//   2. Email verification
//   3. User doc Firestore read (when status check is needed)
//   4. Status check (suspended / banned)
//   5. Admin check (delegated to config.requireAdmin)

import { HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import type {
  AssertAuthConfig,
  AssertAuthFn,
  AuthContext,
  AuthRequirements,
} from "./types.js";

export function createAssertAuth<TUser, TAdmin = void>(
  config: AssertAuthConfig<TUser, TAdmin>
): AssertAuthFn<TUser, TAdmin> {
  return async function assertAuth(
    request: CallableRequest,
    requirements: AuthRequirements = {}
  ): Promise<AuthContext<TUser, TAdmin>> {
    // 1. Authentication check (always first)
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be authenticated");
    }

    const uid = request.auth.uid;
    const token = request.auth.token;

    // 2. Email verification check
    if (
      requirements.emailVerified === true &&
      requirements.allowUnverified !== true
    ) {
      if (token.email_verified !== true) {
        throw new HttpsError("failed-precondition", "Email must be verified");
      }
    }

    // 3. User doc Firestore read (skipped when allowAnyStatus is set)
    const db = config.firestore();
    const userSnap =
      requirements.allowAnyStatus !== true
        ? await db.doc(config.userProfilePath(uid)).get()
        : null;

    let userDoc: TUser | undefined;

    // 4. Status check (default: block suspended + banned; skipped if allowAnyStatus)
    if (requirements.allowAnyStatus !== true) {
      if (!userSnap || !userSnap.exists) {
        throw new HttpsError("not-found", "User profile not found");
      }
      const userData = userSnap.data() as TUser;
      const status = config.getUserStatus(userData);
      if (status === "banned") {
        throw new HttpsError(
          "permission-denied",
          "Account is not in good standing"
        );
      }
      if (status === "suspended" && requirements.allowSuspended !== true) {
        throw new HttpsError(
          "permission-denied",
          "Account is not in good standing"
        );
      }
      userDoc = userData;
    }

    // 5. Admin check (delegates to config.requireAdmin)
    let adminResult: TAdmin | undefined;
    if (requirements.admin !== undefined) {
      adminResult = await config.requireAdmin(uid, token, requirements.admin);
    }

    // 6. Return context with whatever docs were fetched
    const ctx: AuthContext<TUser, TAdmin> = { uid, token };
    if (userDoc !== undefined) {
      ctx.userDoc = userDoc;
    }
    if (requirements.admin !== undefined) {
      ctx.admin = adminResult as TAdmin;
    }
    return ctx;
  };
}
