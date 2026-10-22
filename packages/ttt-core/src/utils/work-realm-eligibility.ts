import type { WorkRealm } from '../doc-schemas/work-project.js';

type ReleasedPublicRealmFields = Pick<WorkRealm, 'realmType' | 'realmStatus' | 'realmHidden'>;

export const RELEASED_PUBLIC_REALM_CRITERIA = {
  realmType: 'public',
  realmStatus: 'released',
  realmHidden: false,
} as const satisfies ReleasedPublicRealmFields;

type ReleasedPublicRealmCriteria = typeof RELEASED_PUBLIC_REALM_CRITERIA;

export type ReleasedPublicRealmEqualityFilter = {
  [K in keyof ReleasedPublicRealmCriteria]: { field: K; value: ReleasedPublicRealmCriteria[K] };
}[keyof ReleasedPublicRealmCriteria];

export const RELEASED_PUBLIC_REALM_EQUALITY_FILTERS: ReleasedPublicRealmEqualityFilter[] = (
  Object.keys(RELEASED_PUBLIC_REALM_CRITERIA) as (keyof ReleasedPublicRealmCriteria)[]
).map(
  (field) =>
    ({ field, value: RELEASED_PUBLIC_REALM_CRITERIA[field] }) as ReleasedPublicRealmEqualityFilter,
);

export function isReleasedPublicRealm(realm: ReleasedPublicRealmFields): boolean {
  return (
    realm.realmType === RELEASED_PUBLIC_REALM_CRITERIA.realmType &&
    realm.realmStatus === RELEASED_PUBLIC_REALM_CRITERIA.realmStatus &&
    realm.realmHidden === RELEASED_PUBLIC_REALM_CRITERIA.realmHidden
  );
}
