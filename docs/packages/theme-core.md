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

## Semantic token defaults

Every token the shared vocabulary reads — theme-core's own recipes, and ui-core's components through Tailwind colour utilities (`border-input`) or `var(--x)` — resolves in every theme. `contract.css` / `tokens.css` declare it in `:root`; `.dark` and `.high-contrast` redeclare it where a dark canvas needs a different value, and otherwise the `:root` value holds (a `var()`-derived default such as `--input: var(--border)` re-resolves per theme). An app that never sets a token still renders correctly. The app's token layer (imported after `styles.css`) overrides any of them, and should set a token in every theme block it cares about: an app `:root` value outranks theme-core's `.dark` default by source order.

`__tests__/token-contract.test.ts` guards the class: every variable any package's source or stylesheet reads without a fallback, and every semantic Tailwind colour utility in any package's class lists (`className`, `cn`/`cva`, class-string constants — never prose or style strings), must resolve to a theme-core `:root` token — never an app-defined variable such as Tailwind's `--color-*`. Runtime-set variables (`--radix-*`) are the only allowlisted exception.

## Recipes and components read tokens, not literals

- **Values live only in token declarations.** No theme-core recipe, no package stylesheet, and no package's component source carries a raw colour (a hex, `rgb()`, numeric `hsl()`, or a Tailwind palette utility) or a Tailwind shadow utility; the guard enforces all of it.
- **Two token formats.** Semantic colour tokens are HSL triplets read as `hsl(var(--x))` (e.g. `--input`, `--destructive-border`, `--brand-primary-deep`, the `--inverted-*` trio — each derived from its base token by default). The component colours ui-core once took from Tailwind's palette (e.g. `--scrim`, `--button-success`, the `--toast-*` families) are COMPLETE CSS colours read as `var(--x)`: their defaults are Tailwind's wide-gamut oklch values, which a triplet cannot express, so an app sets them to any colour. `tokens.css` holds the full set, grouped by format. A triplet read bare (`color: var(--foreground)`) is an invalid colour that silently falls back, so the guard fails on any triplet token read outside `hsl()` / `hsla()`.
- **Shadows are token- and class-owned.** A Tailwind utility sits above every layered stylesheet, so a shadow utility on a ui-core component would out-rank its recipe and every app rule. ui-core carries none: its shadows live on theme-core classes — `.card-border` (Card), `.elevation-popover` (menus, select lists, tooltips), `.elevation-raised` (dialogs, sheets, toasts, sub-menus, floating buttons, the switch thumb), `.tabs-trigger[data-state="active"]` — and every recipe (`.page-card`, the select triggers, `.app-header`, the view toggle) reads a shadow token (`--card-shadow`, `--popover-shadow`, `--control-shadow`, …). The light defaults are the black drop shadows these surfaces always had; `.dark` and `.high-contrast` redeclare each as a foreground-coloured aura, because a dark drop shadow reads as nothing on a dark canvas. An app re-inks a surface by setting its token, or restyles it with its own class rule. Any package's component (not just ui-core's) uses these hooks — chat-react's floating scroll-to-latest button wears `.elevation-raised`.
- **Shadows compose with focus rings.** A Tailwind ring utility writes the whole `box-shadow` as a composite ending in `var(--tw-shadow)`, so every theme-core shadow rule sets `--tw-shadow` to the same token as its `box-shadow`: the elevation stays visible under a keyboard focus ring. An app rule that restyles one of these shadows sets both for the same reason.
