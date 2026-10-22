/** Stored on viewers' devices and accounts: renaming a member forgets every viewer who chose it. */
export const THEME_NAMES = ['light', 'dark', 'high-contrast'] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);
}
