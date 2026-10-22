import type { CallableRequest } from 'firebase-functions/v2/https';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

export interface AuthRequirements<TAdminOptions = never> {
  allowUnverified?: boolean;

  emailVerified?: boolean;

  allowAnyStatus?: boolean;

  allowSuspended?: boolean;

  allowUnaccepted?: boolean;

  admin?: TAdminOptions;
}

export interface AuthContext<TUser = unknown, TAdmin = void> {
  uid: string;
  token: DecodedIdToken;
  userDoc?: TUser;
  admin?: TAdmin;
}

export type UserStatus = 'active' | 'suspended' | 'banned';

export interface AssertAuthConfig<TUser, TAdmin = void, TAdminOptions = never> {
  firestore: () => Firestore;

  userProfilePath: (uid: string) => string;

  getUserStatus: (user: TUser) => UserStatus;

  requireAdmin: (uid: string, token: DecodedIdToken, options: TAdminOptions) => Promise<TAdmin>;

  acceptance?: AcceptanceGateConfig;
}

export interface AcceptanceGateConfig {
  claimKey: string;

  requiredLevel: () => number | Promise<number>;
}

export type AssertAuthFn<TUser, TAdmin = void, TAdminOptions = never> = (
  request: CallableRequest,
  requirements?: AuthRequirements<TAdminOptions>,
) => Promise<AuthContext<TUser, TAdmin>>;
