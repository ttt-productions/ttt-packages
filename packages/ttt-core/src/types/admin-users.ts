// Admin user-directory callable RESULT shapes — cross-boundary contracts (the backend
// builds them, the admin User Management surface renders them), so they live HERE per the
// Cross-Boundary Type Invariant (same rationale as admin-ops.ts). The account status tier
// reuses the ONE canonical UserAccountStatus union (doc-schemas/user.ts) — never a
// re-declared 'active' | 'suspended' | 'banned' literal (Rule 36).

import type { UserAccountStatus } from '../doc-schemas/user.js';

/** One row of the admin display-name prefix search (`searchPublicUsers`). The status tier is
 * resolved server-side from the authoritative `userProfiles/{uid}` doc — `publicUsers` only
 * mirrors a derived `disabled` boolean, not the active/suspended/banned tier. */
export interface PublicUserSearchResult {
  uid: string;
  displayName: string;
  status: UserAccountStatus;
}

/** The `lookupUserByEmailOrUid` callable's result — an EXACT single-account match a solo full
 * admin resolves by email, uid, or display name. Carries the owner-only email (an admin-gated
 * read of the account's privateData) and the admin-claim flag alongside the status tier. */
export interface AdminUserLookupResult {
  uid: string;
  displayName: string;
  email: string;
  status: UserAccountStatus;
  isAdmin?: boolean;
}
