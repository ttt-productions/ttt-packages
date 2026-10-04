// A Realm's working title is unique platform-wide: `reservedRealmNames/{key}` holds one
// reservation per name, keyed case-insensitively. Server-safe.

/**
 * The reservation key a Realm working title is reserved under — the trimmed title, uppercased —
 * so "Dragonlands", "dragonlands", and " Dragonlands " are one name. The ONE key builder for the
 * create, availability, rename, and change-request paths; `realmWorkingTitleSchema` proves the key
 * is one document-id segment before any path is built from it.
 */
export function workRealmNameReservationKey(workingTitle: string): string {
  return workingTitle.trim().toUpperCase();
}
