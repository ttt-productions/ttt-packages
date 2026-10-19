// Admin user-directory callable RESULT shapes — cross-boundary contracts (the backend
// builds them, the admin User Management surface renders them), so they live in ttt-core
// (ARCH-101). The account status tier reuses the ONE canonical UserAccountStatus union
// (doc-schemas/user.ts) — never a re-declared 'active' | 'suspended' | 'banned' literal
// (ARCH-102).

import type { UserAccountStatus } from '../doc-schemas/user.js';

/** One row of the admin display-name prefix search (`searchPublicUsers`). The status tier is
 * resolved server-side from the authoritative `userProfiles/{uid}` doc — `publicUsers` only
 * mirrors a derived `disabled` boolean, not the active/suspended/banned tier. */
export interface PublicUserSearchResult {
  uid: string;
  displayName: string;
  status: UserAccountStatus;
}

