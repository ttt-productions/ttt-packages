// Whether an account may act as a member: it has finished registration — its profile exists — and that
// profile's status is exactly `active`. Fail closed: a missing profile, or any other status, is refused.
// The callable auth assertion refuses every other account before a member callable runs, and a door
// is offered only to an account this answers true for (ENG-006, FRONTEND-110).

import { ACTIVE_USER_STATUS, type UserStatus } from '../types/unions.js';

export function isActiveAccount(profile: { userStatus: UserStatus } | null | undefined): boolean {
  return profile?.userStatus === ACTIVE_USER_STATUS;
}
