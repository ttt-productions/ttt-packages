// The custom-claim contract — the one declaration both roots parse the ID token against.
//
// `isAdmin` and `isReferee` mirror the `_systemData/adminList` rosters; the `status` claim mirrors the
// profile's account status so rules and an open client can refuse a banned account that still
// holds a live token. A claim is a fast hint: a state-changing callable re-reads the roster
// (RULE-STD-BACKEND-004). Team roles are never claims — they resolve from `teamMemberships` per request.

import type { SystemRole, UserStatus } from './unions.js';

export const SYSTEM_ROLE_CLAIM_KEYS = {
  admin: 'isAdmin',
  referee: 'isReferee',
} as const satisfies Record<SystemRole, string>;

export const USER_STATUS_CLAIM_KEY = 'status';

/**
 * V1's role claim names. Nothing reads them: the roster's claim writer removes them whenever it
 * stamps an account, so the cutover's roster copy re-stamps every live holder under
 * `SYSTEM_ROLE_CLAIM_KEYS` (RULE-STD-ENG-011).
 */
export const RETIRED_SYSTEM_ROLE_CLAIM_KEYS = {
  admin: 'admin',
  referee: 'referee',
} as const satisfies Record<SystemRole, string>;

export interface QSportsClaims {
  isAdmin: boolean;
  isReferee: boolean;
  // Absent on a token minted before any status was stamped; treated as `active` by the parser.
  userStatus: UserStatus;
}

export const DEFAULT_Q_SPORTS_CLAIMS: QSportsClaims = {
  isAdmin: false,
  isReferee: false,
  userStatus: 'active',
};

/**
 * Parse a raw ID-token claims object into the typed contract. A role is held only on an exact
 * `true`. An absent status claim reads as `active`: the claim only speeds up refusing a banned
 * account, and the server's profile check — which fails closed — is the authority.
 */
export function parseQSportsClaims(raw: Record<string, unknown>): QSportsClaims {
  return {
    isAdmin: raw[SYSTEM_ROLE_CLAIM_KEYS.admin] === true,
    isReferee: raw[SYSTEM_ROLE_CLAIM_KEYS.referee] === true,
    userStatus: raw[USER_STATUS_CLAIM_KEY] === 'banned' ? 'banned' : 'active',
  };
}
