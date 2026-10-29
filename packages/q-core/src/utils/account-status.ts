// Whether an account may act as a member: it has finished registration — its profile exists — and that
// profile's status is exactly `active`. Fail closed: a missing profile, or any other status, is refused.
// The callable auth assertion refuses every other account before a member callable runs, and a door
// is offered only to an account this answers true for (RULE-STD-ENG-006, RULE-STD-FRONTEND-110).

import { ACTIVE_USER_STATUS } from '../types/unions.js';

export function isActiveAccount(profile: { userStatus: unknown } | null | undefined): boolean {
  return profile?.userStatus === ACTIVE_USER_STATUS;
}
