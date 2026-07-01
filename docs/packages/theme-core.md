# @ttt-productions/theme-core

Generic theme and CSS-token package.

## Owns

- Theme provider wrappers
- CSS token contract
- Component/theme CSS entrypoints
- Breakpoints and theme helpers
- Generic theme switcher React component

## Boundary

Consumer apps own brand-specific copy, imagery, and final token overrides.

## Entry points

- `.` — server-safe root (breakpoints, `REQUIRED_TOKENS` constants). No React, enforced by a boundary test.
- `./react` — `ThemeProvider` (wraps `next-themes`; hardcodes the theme set `["light", "dark", "high-contrast"]`, `attribute="class"`) and `ThemeSwitcher`.
- `./styles.css` — base tokens and variables.
- `./components.css` — shared component CSS patterns.

`ThemeProvider` warns in non-production builds if the consuming app hasn't defined the `REQUIRED_TOKENS` (`--brand-primary`, `--brand-secondary`, `--brand-accent`) or is still using the loud placeholder fallback — the concrete mechanism behind "consumer apps own final token overrides" above.
