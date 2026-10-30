import { ACTIVE_USER_STATUS } from '../types/unions.js';

export function isActiveAccount(profile: { userStatus: unknown } | null | undefined): boolean {
  return profile?.userStatus === ACTIVE_USER_STATUS;
}
