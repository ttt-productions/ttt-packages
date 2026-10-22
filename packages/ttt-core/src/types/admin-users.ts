import type { UserAccountStatus } from '../doc-schemas/user.js';

export interface PublicUserSearchResult {
  uid: string;
  displayName: string;
  status: UserAccountStatus;
}
