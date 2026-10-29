// The custom-claim contract — the one declaration both roots parse the ID token against.
//
// `admin` and `referee` mirror the `_systemData/adminList` rosters; `userStatus` mirrors the
// profile's account status so rules and an open client can refuse a banned account that still
// holds a live token. A claim is a fast hint: a state-changing callable re-reads the roster
// (RULE-STD-BACKEND-004). Team roles are never claims — they resolve from `teamMemberships` per request.

import type { SystemRole, UserStatus } from './unions.js';

export const SYSTEM_ROLE_CLAIM_KEYS = {
  admin: 'admin',
  referee: 'referee',
} as const satisfies Record<SystemRole, string>;

export const USER_STATUS_CLAIM_KEY = 'userStatus';

export interface QSportsClaims {
  admin: boolean;
  referee: boolean;
  // Absent on a token minted before any status was stamped; treated as `active` by the parser.
  userStatus: UserStatus;
}

export const DEFAULT_Q_SPORTS_CLAIMS: QSportsClaims = {
  admin: false,
  referee: false,
  userStatus: 'active',
};

/**
 * Parse a raw ID-token claims object into the typed contract. A role is held only on an exact
 * `true`. An absent status claim reads as `active`: the claim only speeds up refusing a banned
 * account, and the server's profile check — which fails closed — is the authority.
 */
export function parseQSportsClaims(raw: Record<string, unknown>): QSportsClaims {
  return {
    admin: raw[SYSTEM_ROLE_CLAIM_KEYS.admin] === true,
    referee: raw[SYSTEM_ROLE_CLAIM_KEYS.referee] === true,
    userStatus: raw[USER_STATUS_CLAIM_KEY] === 'banned' ? 'banned' : 'active',
  };
}
