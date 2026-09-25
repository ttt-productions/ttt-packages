/**
 * The themes an app renders. `ThemeProvider` hands this set to `next-themes`, and an app types a
 * saved theme by it (an account schema's `z.enum(THEME_NAMES)`) instead of restating it. Each
 * member is a value stored on viewers' devices and accounts, so renaming one forgets their choice.
 */
export const THEME_NAMES = ["light", "dark", "high-contrast"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEME_NAMES as readonly string[]).includes(value);
}
