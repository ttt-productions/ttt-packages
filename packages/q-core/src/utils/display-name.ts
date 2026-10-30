export function normalizeDisplayName(displayName: string): string {
  return displayName.trim();
}

const RESERVED_DISPLAY_NAME_KEY_PREFIX = 'name_';

export function toReservedDisplayNameKey(displayName: string): string {
  return RESERVED_DISPLAY_NAME_KEY_PREFIX + encodeURIComponent(toDisplayNameLowercase(displayName));
}

export function toDisplayNameLowercase(displayName: string): string {
  return normalizeDisplayName(displayName).toLowerCase();
}
