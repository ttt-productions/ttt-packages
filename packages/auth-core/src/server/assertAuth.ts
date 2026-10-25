import type { CallableRequest } from 'firebase-functions/v2/https';
import { ACCEPTANCE_REQUIRED_REASON, normalizeAcceptanceLevel } from '../acceptance.js';
import { EMAIL_VERIFICATION_REQUIRED_REASON } from '../email-verification.js';
import { SIGN_IN_REQUIRED_REASON } from '../sign-in.js';
import { AuthAssertionError } from './authError.js';
import type { AssertAuthConfig, AssertAuthFn, AuthContext, AuthRequirements } from './types.js';

export function createAssertAuth<TUser, TAdmin = void, TAdminOptions = never>(
  config: AssertAuthConfig<TUser, TAdmin, TAdminOptions>,
): AssertAuthFn<TUser, TAdmin, TAdminOptions> {
  return async function assertAuth(
    request: CallableRequest,
    requirements: AuthRequirements<TAdminOptions> = {},
  ): Promise<AuthContext<TUser, TAdmin>> {
    if (!request.auth) {
      throw new AuthAssertionError('unauthenticated', 'You must be authenticated', {
        reason: SIGN_IN_REQUIRED_REASON,
      });
    }

    const uid = request.auth.uid;
    const token = request.auth.token;

    if (requirements.emailVerified === true && requirements.allowUnverified !== true) {
      if (token.email_verified !== true) {
        throw new AuthAssertionError('failed-precondition', 'Email must be verified', {
          reason: EMAIL_VERIFICATION_REQUIRED_REASON,
        });
      }
    }

    const db = config.firestore();
    const userSnap =
      requirements.allowAnyStatus !== true ? await db.doc(config.userProfilePath(uid)).get() : null;

    let userDoc: TUser | undefined;

    if (requirements.allowAnyStatus !== true) {
      if (!userSnap || !userSnap.exists) {
        throw new AuthAssertionError('not-found', 'User profile not found');
      }
      const userData = userSnap.data() as TUser;
      const status = config.getUserStatus(userData);
      if (status === 'banned') {
        throw new AuthAssertionError('permission-denied', 'Account is not in good standing');
      }
      if (status === 'suspended' && requirements.allowSuspended !== true) {
        throw new AuthAssertionError('permission-denied', 'Account is not in good standing');
      }
      userDoc = userData;
    }

    if (config.acceptance !== undefined && requirements.allowUnaccepted !== true) {
      const requiredLevel = normalizeAcceptanceLevel(await config.acceptance.requiredLevel());
      if (requiredLevel > 0) {
        const acceptedLevel = normalizeAcceptanceLevel(
          (token as Record<string, unknown>)[config.acceptance.claimKey],
        );
        if (acceptedLevel < requiredLevel) {
          throw new AuthAssertionError(
            'failed-precondition',
            'The current documents must be accepted before continuing',
            { reason: ACCEPTANCE_REQUIRED_REASON, requiredLevel, acceptedLevel },
          );
        }
      }
    }

    let adminResult: TAdmin | undefined;
    if (requirements.admin !== undefined) {
      adminResult = await config.requireAdmin(uid, token, requirements.admin);
    }

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
