import { describe, it, expect } from 'vitest';
import {
  RELEASED_PUBLIC_REALM_CRITERIA,
  RELEASED_PUBLIC_REALM_EQUALITY_FILTERS,
  isReleasedPublicRealm,
} from '../src/utils';
import { ITEMS_PER_PAGE_REALM_WORKS } from '../src/constants/pagination';
import { WorkRealmSchema } from '../src/doc-schemas/work-project';

const releasedPublic = { realmType: 'public', realmStatus: 'released', realmHidden: false } as const;

describe('released public Realm eligibility', () => {
  it('a public, released, unhidden Realm is eligible', () => {
    expect(isReleasedPublicRealm(releasedPublic)).toBe(true);
  });

  it('a standalone Realm is never eligible', () => {
    expect(isReleasedPublicRealm({ ...releasedPublic, realmType: 'standalone' })).toBe(false);
  });

  it('a draft Realm is not eligible until it is released', () => {
    expect(isReleasedPublicRealm({ ...releasedPublic, realmStatus: 'draft' })).toBe(false);
  });

  it('a Realm hidden by moderation is not eligible', () => {
    expect(isReleasedPublicRealm({ ...releasedPublic, realmHidden: true })).toBe(false);
  });

  it('the search filters state the same three conditions the predicate checks', () => {
    expect(RELEASED_PUBLIC_REALM_EQUALITY_FILTERS).toEqual([
      { field: 'realmType', value: 'public' },
      { field: 'realmStatus', value: 'released' },
      { field: 'realmHidden', value: false },
    ]);
    const fromFilters = Object.fromEntries(RELEASED_PUBLIC_REALM_EQUALITY_FILTERS.map((f) => [f.field, f.value]));
    expect(fromFilters).toEqual(RELEASED_PUBLIC_REALM_CRITERIA);
  });

  it('every filter names a field the Realm document declares, with a value it accepts', () => {
    for (const { field, value } of RELEASED_PUBLIC_REALM_EQUALITY_FILTERS) {
      expect(WorkRealmSchema.shape[field].safeParse(value).success).toBe(true);
    }
  });
});

describe('the Realm page Works list', () => {
  it('reads 12 Works per page', () => {
    expect(ITEMS_PER_PAGE_REALM_WORKS).toBe(12);
  });
});
