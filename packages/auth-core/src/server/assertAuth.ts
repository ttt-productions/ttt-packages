// packages/auth-core/src/server/assertAuth.ts
//
// Factory that produces an assertAuth function bound to a consuming app's
// Firestore paths, user/project shapes, and admin check.
//
// Every Cloud Functions callable in the consuming app should invoke the
// returned assertAuth as its first executable line. The check order is:
//   1. Authentication
//   2. Email verification
//   3. Parallel Firestore reads (user doc + project doc, as needed)
//   4. Status check (banned / disabled)
//   5. Creator check
//   6. Project membership check
//   7. Admin check (delegated to config.requireAdmin)

import { HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import type {
  AssertAuthConfig,
  AssertAuthFn,
  AuthContext,
  AuthRequirements,
} from "./types.js";

export function createAssertAuth<TUser, TProject>(
  config: AssertAuthConfig<TUser, TProject>
): AssertAuthFn<TUser, TProject> {
  return async function assertAuth(
    request: CallableRequest,
    requirements: AuthRequirements = {}
  ): Promise<AuthContext<TUser, TProject>> {
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

    // 3. Determine which Firestore reads are needed
    const needsUserDoc =
      requirements.creator === true || requirements.allowAnyStatus !== true;
    const needsProject = requirements.projectMembership !== undefined;

    const db = config.firestore();
    const [userSnap, projectSnap] = await Promise.all([
      needsUserDoc
        ? db.doc(config.userProfilePath(uid)).get()
        : Promise.resolve(null),
      needsProject
        ? db.doc(config.projectPath(requirements.projectMembership!.projectId)).get()
        : Promise.resolve(null),
    ]);

    let userDoc: TUser | undefined;

    // 4. Status check (default: block banned + disabled; skipped if allowAnyStatus)
    if (requirements.allowAnyStatus !== true) {
      if (!userSnap || !userSnap.exists) {
        throw new HttpsError("not-found", "User profile not found");
      }
      const userData = userSnap.data() as TUser;
      const status = config.getUserStatus(userData);
      if (status === "disabled") {
        throw new HttpsError(
          "permission-denied",
          "Account is not in good standing"
        );
      }
      if (status === "banned" && requirements.allowBanned !== true) {
        throw new HttpsError(
          "permission-denied",
          "Account is not in good standing"
        );
      }
      userDoc = userData;
    }

    // 5. Creator check
    if (requirements.creator === true) {
      if (!userDoc) {
        // allowAnyStatus is true — user doc was still fetched, validate now
        if (!userSnap || !userSnap.exists) {
          throw new HttpsError("not-found", "User profile not found");
        }
        userDoc = userSnap.data() as TUser;
      }
      if (!config.isUserCreator(userDoc)) {
        throw new HttpsError("failed-precondition", "Creator status required");
      }
    }

    // 6. Project membership check
    let projectContext: AuthContext<TUser, TProject>["project"];
    if (requirements.projectMembership !== undefined) {
      if (!projectSnap || !projectSnap.exists) {
        throw new HttpsError("not-found", "Project not found");
      }
      const projectData = projectSnap.data() as TProject;
      const isOwner = config.isProjectOwner(projectData, uid);
      const isMember = isOwner || config.isProjectMember(projectData, uid);

      if (requirements.projectMembership.role === "owner") {
        if (!isOwner) {
          throw new HttpsError(
            "permission-denied",
            "Project owner access required"
          );
        }
      } else {
        if (!isMember) {
          throw new HttpsError(
            "permission-denied",
            "Not a member of this project"
          );
        }
      }

      projectContext = { data: projectData, isOwner, isMember };
    }

    // 7. Admin check (delegates to config.requireAdmin)
    if (requirements.admin !== undefined) {
      await config.requireAdmin(uid, token, requirements.admin);
    }

    // 8. Return context with whatever docs were fetched
    const ctx: AuthContext<TUser, TProject> = { uid, token };
    if (userDoc !== undefined) {
      ctx.userDoc = userDoc;
    }
    if (projectContext !== undefined) {
      ctx.project = projectContext;
    }
    return ctx;
  };
}
