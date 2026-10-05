// A display name is unique platform-wide, case-insensitively. Server-safe.

/**
 * The key a display name is reserved and blocked under — the name uppercased — so "Ada" and "ADA"
 * are one name. The ONE key rule for the `reservedDisplayNames/{key}` reservations and the
 * `_systemData/reservedUsernames` blocked-names list alike; `displayNameSchema` proves the name is
 * one document-id segment before any path is built from its key.
 */
export function displayNameReservationKey(displayName: string): string {
  return displayName.toUpperCase();
}
