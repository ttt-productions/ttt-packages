// Display-name normalization shared by every writer of `displayName` / `displayName_lowercase`.

export function normalizeDisplayName(displayName: string): string {
  return displayName.trim();
}

const RESERVED_DISPLAY_NAME_KEY_PREFIX = 'name_';

/**
 * The `reservedDisplayNames` document id for a display name. Uniqueness is case-insensitive, so the
 * key is built from the lowercase form. It is percent-encoded because a name may hold a `/`, which
 * a document id cannot, and prefixed because percent-encoding leaves `_` and `.` alone — without
 * the prefix the name `__a__` would be an id Firestore reserves (`__.*__`) and rejects.
 */
export function toReservedDisplayNameKey(displayName: string): string {
  return RESERVED_DISPLAY_NAME_KEY_PREFIX + encodeURIComponent(toDisplayNameLowercase(displayName));
}

/** The value stored in `displayName_lowercase`, which powers prefix search and uniqueness checks. */
export function toDisplayNameLowercase(displayName: string): string {
  return normalizeDisplayName(displayName).toLowerCase();
}
