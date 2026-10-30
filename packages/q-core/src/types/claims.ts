import type { SystemRole, UserStatus } from './unions.js';

export const SYSTEM_ROLE_CLAIM_KEYS = {
  admin: 'isAdmin',
  referee: 'isReferee',
} as const satisfies Record<SystemRole, string>;

export const USER_STATUS_CLAIM_KEY = 'status';

export const RETIRED_SYSTEM_ROLE_CLAIM_KEYS = {
  admin: 'admin',
  referee: 'referee',
} as const satisfies Record<SystemRole, string>;

export interface QSportsClaims {
  isAdmin: boolean;
  isReferee: boolean;
  userStatus: UserStatus;
}

export const DEFAULT_Q_SPORTS_CLAIMS: QSportsClaims = {
  isAdmin: false,
  isReferee: false,
  userStatus: 'active',
};

export function parseQSportsClaims(raw: Record<string, unknown>): QSportsClaims {
  return {
    isAdmin: raw[SYSTEM_ROLE_CLAIM_KEYS.admin] === true,
    isReferee: raw[SYSTEM_ROLE_CLAIM_KEYS.referee] === true,
    userStatus: raw[USER_STATUS_CLAIM_KEY] === 'banned' ? 'banned' : 'active',
  };
}
