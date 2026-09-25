# @ttt-productions/theme-core

Generic theme and CSS-token package.

## Owns

- The theme set and the theme provider over `next-themes`
- The viewer settings mechanism: the device store for motion, the `<html>` reduced-motion attribute, and the account sync for theme and motion
- CSS token contract
- Component/theme CSS entrypoints
- Breakpoints and theme helpers
- Generic theme switcher React component

## Boundary

Consumer apps own brand-specific copy, imagery, and final token overrides. They also own every storage key and event name the viewer settings use, the CSS kill switch the reduced-motion attribute drives, the account's storage and write (the sync's adapter), and all settings UI, the compare prompt's included.

## Entry points

- `.` — server-safe root: breakpoints, `REQUIRED_TOKENS`, the theme set (`THEME_NAMES`, `ThemeName`), `REDUCED_MOTION_ATTRIBUTE`, and the viewer-settings types an app's adapter and prompt UI use (`ViewerSettings`, `ViewerSettingName`, `SavedViewerSettings`, `ViewerSettingDifference`). No React, enforced by a boundary test. The account sync's pure logic sits in the same server-safe tree so it is tested without React, but it is internal: apps use the sync, not its steps.
- `./react` — `ThemeProvider`, `ThemeSwitcher`, `createReducedMotionStore`, and `ViewerSettingsSyncProvider` / `useViewerSettingsSync`.
- `./styles.css` — base tokens and variables.
- `./components.css` — shared component CSS patterns.

`ThemeProvider` wraps `next-themes` with `attribute="class"` and hands it `THEME_NAMES`. Its `storageKey` is the app's (next-themes' own `theme` when the app passes none), and it publishes that key to the account sync. It warns in non-production builds if the consuming app hasn't defined the `REQUIRED_TOKENS` (`--brand-primary`, `--brand-secondary`, `--brand-accent`) or is still using the loud placeholder fallback — the concrete mechanism behind "consumer apps own final token overrides" above.

## Viewer settings

A viewer's theme and motion choice live on the device and, while they are signed in, on their account. theme-core owns the mechanism; each app supplies its keys, its account read and write, and its UI.

**The theme set.** `THEME_NAMES` (`'light' | 'dark' | 'high-contrast'`) is the one declaration: `ThemeProvider` passes it to `next-themes`, `ThemeSwitcher`'s options are typed by it, and an app's account schema types a saved theme with it (`z.enum(THEME_NAMES)`), never a second union. Each name is a persisted value.

**The motion store.** `createReducedMotionStore({ storageKey, changeEvent })` is called once, at module scope, with the app's key and event. Effective reduced motion is the device's `prefers-reduced-motion` request OR the saved preference, and the device always wins: a saved "full motion" never turns motion back on. The saved preference is stored as `"true"` / `"false"`; absent means nothing is saved. Components read the effective value, the device request, and the saved value through the store's hooks; JS-scheduled motion reads `prefersReducedMotion()` at the moment it schedules. `useApplyReducedMotion()`, mounted once in the app shell, stamps `data-reduced-motion="true"` on `<html>`. A save notifies its own tab through the app's change event and other tabs through the native `storage` event. The store's setter writes the device alone.

**Blocked storage.** A browser that blocks site data throws on every `localStorage` call. The store and the sync read that as "nothing saved" and hold each write in memory for the life of the page, so every page still renders and a viewer's choice still takes effect until they leave. A theme set through the account sync is held the same way, beside `next-themes`' own in-memory theme.

The CSS kill switch stays app-side, beside the rule that defines it: it keys on `:root[data-reduced-motion='true']`, plus an `@media (prefers-reduced-motion: reduce)` block for the paint before the store runs. Nothing else checks the media query.

**The account sync.** `ViewerSettingsSyncProvider` is mounted once, inside `ThemeProvider`, with the motion store, a dismissal storage key, and the app's account adapter:

- `accountId`: the signed-in account's id, `null` while signed out. Signed out, settings live on the device alone.
- `settings`: the account's saved theme and motion, `null` for a setting it has not saved. It is `undefined` while the read is loading or failing, never all-`null` in its place: all-`null` means an account with nothing saved, which the sync fills with the device's values, so a failed read passed as all-`null` would overwrite the account's real values.
- `save(partial)`
- `onSilentSaveError(error)`

`useViewerSettingsSync()` returns the device's current theme (`undefined` until hydration), `setTheme`, `setReducedMotion`, and `prompt`.

- Every change made through the sync goes to the device at once and, signed in, to the account. The returned promise rejects when the account write fails, so the control that started it shows its pending state and the failure. Under the sync, `ThemeSwitcher`'s `onSelect` goes through it too, and settings change through the sync, not the store's device-only setter.
- Nothing is compared until the viewer is signed in, the account's values have loaded, and hydration has finished. Before hydration the device reads as the server's "nothing saved", and comparing that would hand the device the account's values over its own.
- The sync keeps a record of the signed-in account: each setting's baseline, this tab's saves in flight, and the silent-save attempt. The record starts over whenever `accountId` changes, a sign-out or sign-in included, so a save belongs to the account that made it. `settings` going `undefined` (a read loading or failing) only pauses the comparison and keeps the record, so a read that fails and recovers picks up where it left off.
- A setting the device has nothing saved for takes the account's value silently. A setting the account has nothing saved for takes the device's value silently, so signing in saves what the viewer chose while signed out. A failed silent save goes to `onSilentSaveError` and is not retried until the account's values change, `accountId` changes, or the app loads again; a read that fails and recovers does not retry it.
- A viewer's own change never opens the prompt. Each setting is tracked on its own: a setting stays out of the comparison while a save of it from this tab is pending, or has landed but its value has not yet reached the account's values. A setting changed on this device by any tab is compared again only when that setting's account value next changes.
- When both sides hold different values, `prompt` lists each differing setting that is not dismissed, with `adoptAccountSettings()`, `saveDeviceSettings()`, and `dismiss()`, each acting on the listed settings. The prompt is non-blocking and its UI is the app's. After `saveDeviceSettings()` it stays until the account's values arrive reflecting the save.
- Dismissing keeps the device's values and remembers each listed difference on its own, as its setting with its device and account values, under the dismissal key. A dismissed difference is not asked about again while both of those values hold; changing another setting does not bring it back. A dismissal whose values no longer hold is dropped.
- No saved value forces motion on: an account's "full motion" taken by a device that asks for less leaves motion reduced.

## Semantic token defaults

Every token the shared vocabulary reads — theme-core's own recipes, and ui-core's components through Tailwind colour utilities (`border-input`) or `var(--x)` — resolves in every theme. `contract.css` / `tokens.css` declare it in `:root`; `.dark` and `.high-contrast` redeclare it where a dark canvas needs a different value, and otherwise the `:root` value holds (a `var()`-derived default such as `--input: var(--border)` re-resolves per theme). An app that never sets a token still renders correctly. The app's token layer (imported after `styles.css`) overrides any of them, and should set a token in every theme block it cares about: an app `:root` value outranks theme-core's `.dark` default by source order.

`__tests__/token-contract.test.ts` guards the class: every variable any package's source or stylesheet reads without a fallback, and every semantic Tailwind colour utility in any package's class lists (`className`, `cn`/`cva`, class-string constants — never prose or style strings), must resolve to a theme-core `:root` token — never an app-defined variable such as Tailwind's `--color-*`. Runtime-set variables (`--radix-*`) are the only allowlisted exception.

## Recipes and components read tokens, not literals

- **Values live only in token declarations.** No theme-core recipe, no package stylesheet, and no package's component source carries a raw colour (a hex, `rgb()`, numeric `hsl()`, or a Tailwind palette utility) or a Tailwind shadow utility; the guard enforces all of it. Nor does any package hide a colour in a `var()` fallback — `hsl(var(--muted, 220 14% 96%))` is a second copy of the value that renders whenever the token is missing, and every token a package reads already resolves from theme-core's `:root`. The guard checks every fallback in every stylesheet declaration (token declarations included) and in every string of every package's component source — a Tailwind arbitrary value such as `bg-[hsl(var(--x,_0_84%_60%))]` is decoded first — for a bare HSL triplet as well as the literal forms above.
- **Two token formats.** Semantic colour tokens are HSL triplets read as `hsl(var(--x))` (e.g. `--input`, `--destructive-border`, `--brand-primary-deep`, the `--inverted-*` trio — each derived from its base token by default). The component colours ui-core once took from Tailwind's palette (e.g. `--scrim`, `--button-success`, the `--toast-*` families) are COMPLETE CSS colours read as `var(--x)`: their defaults are Tailwind's wide-gamut oklch values, which a triplet cannot express, so an app sets them to any colour. `tokens.css` holds the full set, grouped by format. A triplet read bare (`color: var(--foreground)`) is an invalid colour that silently falls back, so the guard fails on any triplet token read outside `hsl()` / `hsla()`.
- **A solid status fill carries its own status foreground.** A fill from the destructive / success / warning / info family (the semantic token, its `--status-*` base, or a component colour such as `--button-success` or `--toast-success`) takes its text from that family's own `-foreground` token, never another family's: a fill under a foreign foreground is unreadable in some theme even though both tokens resolve. A faint tint (an alpha fill) is not a solid fill and carries ordinary body text instead. The guard checks every package's class lists and stylesheets; a solid status fill that renders no text (a dot) is a named, justified exemption.
- **Shadows are token- and class-owned.** A Tailwind utility sits above every layered stylesheet, so a shadow utility on a ui-core component would out-rank its recipe and every app rule. ui-core carries none: its shadows live on theme-core classes — `.card-border` (Card), `.elevation-popover` (menus, select lists, tooltips), `.elevation-raised` (dialogs, sheets, toasts, sub-menus, floating buttons, the switch thumb), `.tabs-trigger[data-state="active"]` — and every recipe (`.page-card`, the select triggers, `.app-header`, the view toggle) reads a shadow token (`--card-shadow`, `--popover-shadow`, `--control-shadow`, …). The light defaults are the black drop shadows these surfaces always had; `.dark` and `.high-contrast` redeclare each as a foreground-coloured aura, because a dark drop shadow reads as nothing on a dark canvas. An app re-inks a surface by setting its token, or restyles it with its own class rule. Any package's component (not just ui-core's) uses these hooks — chat-react's floating scroll-to-latest button wears `.elevation-raised`.
- **Scale classes are declared, never assumed.** The `stack-*` (vertical rhythm between block children), `icon-*`, and `spinner-*` families live in `components.css`. Tailwind defines none of these names, so a member theme-core does not declare matches no rule and its element silently loses its spacing or size; the guard fails when any package's class lists render one. A `stack-*` class spaces its children with a vertical margin, so it only works on block children.
- **Shadows compose with focus rings.** A Tailwind ring utility writes the whole `box-shadow` as a composite ending in `var(--tw-shadow)`, so every theme-core shadow rule sets `--tw-shadow` to the same token as its `box-shadow`: the elevation stays visible under a keyboard focus ring. An app rule that restyles one of these shadows sets both for the same reason.
