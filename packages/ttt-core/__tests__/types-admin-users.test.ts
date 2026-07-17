import { describe, it, expectTypeOf } from 'vitest';
import type { PublicUserSearchResult, AdminUserLookupResult } from '../src/types/admin-users';
import type { UserAccountStatus } from '../src/doc-schemas/user';

describe('admin user-directory result types', () => {
  it('PublicUserSearchResult reuses the canonical UserAccountStatus union for its status tier', () => {
    expectTypeOf<PublicUserSearchResult['status']>().toEqualTypeOf<UserAccountStatus>();
    const row: PublicUserSearchResult = { uid: 'u-1', displayName: 'Someone', status: 'active' };
    expectTypeOf(row).toMatchTypeOf<PublicUserSearchResult>();
  });

  it('AdminUserLookupResult carries email + optional isAdmin and reuses UserAccountStatus', () => {
    expectTypeOf<AdminUserLookupResult['status']>().toEqualTypeOf<UserAccountStatus>();
    expectTypeOf<AdminUserLookupResult['isAdmin']>().toEqualTypeOf<boolean | undefined>();
    const minimal: AdminUserLookupResult = {
      uid: 'u-1',
      displayName: 'Someone',
      email: 'someone@example.com',
      status: 'suspended',
    };
    expectTypeOf(minimal).toMatchTypeOf<AdminUserLookupResult>();
  });
});
