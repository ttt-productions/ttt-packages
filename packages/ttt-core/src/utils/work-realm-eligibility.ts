import type { WorkRealm } from '../doc-schemas/work-project.js';

type ReleasedPublicRealmFields = Pick<WorkRealm, 'realmType' | 'realmStatus' | 'realmHidden'>;

/**
 * The one definition of a Realm a new Work may be built into and that Realm search lists: a
 * public Realm (a standalone Realm is a single Work's own background Realm), released, and not
 * hidden by moderation. The backend check, the search filters, and any client gate derive from it.
 */
export const RELEASED_PUBLIC_REALM_CRITERIA = {
  realmType: 'public',
  realmStatus: 'released',
  realmHidden: false,
} as const satisfies ReleasedPublicRealmFields;

type ReleasedPublicRealmCriteria = typeof RELEASED_PUBLIC_REALM_CRITERIA;

/** One equality filter of the criteria, in the `{ field, value }` shape a Firestore search takes. */
export type ReleasedPublicRealmEqualityFilter = {
  [K in keyof ReleasedPublicRealmCriteria]: { field: K; value: ReleasedPublicRealmCriteria[K] };
}[keyof ReleasedPublicRealmCriteria];

/** The criteria as Firestore equality filters, in the criteria's field order. */
export const RELEASED_PUBLIC_REALM_EQUALITY_FILTERS: ReleasedPublicRealmEqualityFilter[] = (
  Object.keys(RELEASED_PUBLIC_REALM_CRITERIA) as (keyof ReleasedPublicRealmCriteria)[]
).map((field) => ({ field, value: RELEASED_PUBLIC_REALM_CRITERIA[field] }) as ReleasedPublicRealmEqualityFilter);

/** True when the Realm meets every released-public condition. */
export function isReleasedPublicRealm(realm: ReleasedPublicRealmFields): boolean {
  return (
    realm.realmType === RELEASED_PUBLIC_REALM_CRITERIA.realmType &&
    realm.realmStatus === RELEASED_PUBLIC_REALM_CRITERIA.realmStatus &&
    realm.realmHidden === RELEASED_PUBLIC_REALM_CRITERIA.realmHidden
  );
}
