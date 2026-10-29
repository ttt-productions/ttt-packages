# Frontend core rules — component & style system (FRONTEND)

Format, scopes, and rule IDs: [../README.md](../README.md).

**This file is read in full whenever a task routes to frontend** — components, CSS/theming, React Query, client callables, UX states, or browser storage. These rules sharpen RULE-STD-ENG-002 (one change point) and RULE-STD-ENG-003 (extend existing owners) for the UI and its device-local state.

**The two topic files are conditional — read one only when the work touches its topic:**

- [data-and-callable-access.md](data-and-callable-access.md) (100s) — React Query (hooks, query keys, invalidation), a callable invoked from the client, or deciding whether the UI offers an action. A CSS-only or pure-markup change does not touch it.
- [interaction-accessibility-and-motion.md](interaction-accessibility-and-motion.md) (200s) — an async control's pending state, a confirmation, an in-app navigation, a loading/empty state, an editor holding unsaved input, keyboard/focus/ARIA behavior, pointer or gesture handling, animation or motion.

Code is the value truth: an app's `brand.css` tokens and `components.css` classes; its UI design doc explains the system.

### RULE-STD-FRONTEND-001 — One canonical component/variant/class per repeated UI pattern
**Scope.** both

**Rule.** Every repeated UI pattern — button, dropdown/select, link, "show more"/expansion control, card, dialog, table, chip/toggle, pending/empty/error state, clickable list row — has one canonical component, variant, or semantic class. Before adding ANY such control, find the existing pattern and use or extend it. If touched code already contains inconsistent versions of one pattern, surface them with a consolidation recommendation (RULE-STD-ENG-008) and pick the canonical owner — never add another variant to match one.

**Apps:** two owners are named because they are reinvented most: a read's pending / failed / empty / content states render through the read-state module (`<READ_STATE_MODULE>` — its read, failure, list-failure, and render-failure states and its read combiner), which renders the one failure seat (`<LOAD_ERROR_STATE>`); and a row that opens something while holding controls of its own is ui-core's `ActionRow` (`@ttt-productions/ui-core/react`).

**Why.** Every locally reinvented control is drift the moment it is written. Hand-written read switches drift the same way: a failure that offers no retry, a failure that turns into a spinner under the press, and a row built as one `<button>` that cuts a control inside it off from its own retry.

**Prohibits.**
- A new raw primitive, local wrapper copy, or copied style block where a canonical component/variant/class exists.
- "It was faster to build my own" button/card/dialog; adding a second variant to match an inconsistent screen instead of consolidating.
- A surface rendering `<LOAD_ERROR_STATE>` or calling the module's list retry itself instead of going through `<READ_STATE_MODULE>`; a row that holds a control built as a `<button>` wrapping the row.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-003; RULE-STD-FRONTEND-109, RULE-STD-FRONTEND-206; ttt-packages `docs/packages/ui-core.md`.

### RULE-STD-FRONTEND-002 — One stylesheet entry point, pinned layer order, no direct CSS imports
**Scope.** apps

**Rule.** `src/app/layout.tsx` imports exactly ONE stylesheet, `./styles/globals.css`. Every other sheet joins there via `@import '…' layer(base)` in the pinned order (theme-core `styles.css` → theme-core `components.css` → package styles → `brand.css` → `base.css` → `components.css` → page-scoped sheets → `overrides.css` in `layer(overrides)` → `@import 'tailwindcss'` last), with one `@source` line per package that renders classes. The layer order is fixed by the file's first statement `@layer theme, base, components, utilities, overrides;`. `overrides.css` stays TINY — only rules whose entire purpose is beating a Tailwind utility belong there, and every rule in it names the utility it beats.

**Why.** An unlayered direct import beats every layered rule regardless of specificity and silently disables layered overrides app-wide; a package whose classes Tailwind never scans renders unstyled.

**Prohibits.**
- A CSS import in `layout.tsx` or any component other than `globals.css` (an unlayered duplicate).
- Reordering the layered imports; putting ordinary styling in `overrides.css`; an `overrides.css` rule that does not name the utility it beats; a second `layer(overrides)` sheet.
- A class-rendering package with no `@source` line, or two lines for one package.

**References.** RULE-STD-FRONTEND-008.

### RULE-STD-FRONTEND-003 — All colors resolve through theme tokens; no hex or raw HSL in app code
**Scope.** apps

**Rule.** Every color renders as `hsl(var(--token))` from the theme system — semantic tokens (`--background`, `--card`, `--muted-foreground`, `--border`, `--ring`) or the brand tokens in `brand.css`. Components and app CSS never introduce a hardcoded hex, `rgb()`, or raw `hsl(…)` literal, a Tailwind palette class, or a one-off theme value; a color value that does not exist yet is added to `brand.css` first. Every theme the app declares — light (`:root`), dark (`.dark`), and high-contrast (`.high-contrast`) — works on any new surface, and a theme-varying token is declared in all three theme blocks.

**Why.** A hardcoded color is invisible to theme switching and high contrast, and is exactly the "invented its own colors" failure class this rulebook exists to prevent; a token missing from one theme block silently falls back to another theme's value there.

**Prohibits.**
- A hex, `rgb()`, or raw `hsl()` literal in a `.tsx`/`.css` file; an inline `style={{ color: '#…' }}`.
- A Tailwind palette class (`text-red-500`, `bg-slate-900`) in place of a token.
- A new one-off `--brand-x` token minted at a call site instead of using or first adding a `brand.css` token.
- A theme-varying token declared in some theme blocks but not all three.

**References.** RULE-STD-ENG-002; RULE-STD-FRONTEND-008.

### RULE-STD-FRONTEND-006 — State changes swap icons; destructive red lives only inside confirmation dialogs
**Scope.** apps

**Rule.** A state change swaps the ICON, never the color or variant (the app's addition names its icon pairs). Red/destructive is reserved for the confirm action **inside a dialog** and for urgency text — never an inline destructive button. Report/delete/secondary actions live behind the app's one shared "…" actions menu; where a destructive trigger must sit inline it renders neutral (outline/ghost) and only the dialog's confirm is red.

**Why.** Color-swap state is ambiguous across themes and collides with the app's affordance colors; icon-swap reads the same everywhere.

**Prohibits.**
- A color/variant change to signal state (e.g. a green "success" toggle button); one icon used for two different actions.
- An inline red destructive button outside a dialog confirm.

**References.** RULE-STD-FRONTEND-202.

### RULE-STD-FRONTEND-007 — One page column, one card recipe, truncation everywhere
**Scope.** apps

**Rule.** Every page wraps its content in `ScreenAdaptiveView` (ui-core) with the `page-container` class — a full-width single column that centers to a max-width on desktop; content fills it (no per-component `max-w-*` caps on page-level cards). Every branch of a page — loading, empty, and error included — renders inside that page container. A deliberate full-width exception exists only where the app's addition names it. Page-level content cards use the `.page-card` semantic class — never ad-hoc `bg-card` + `shadow-xl` borderless cards; dark-theme elevation is lightening + faint border, never dark drop shadows. Every user-supplied title and name renders through theme-core's one shared truncation class (`.single-line-truncate`), and a block of user text cut to a few lines through its three-line clamp (`.three-line-clamp`), so long content never breaks layout; where the truncated text is the record's only identification, the full value stays reachable through its accessible name or title.

**Why.** Consistent column, card, and truncation recipes keep every screen visually one system and stop long user content from breaking layout; a loading or error branch rendered outside the container jumps the layout, and a truncated name with no full value leaves the record unidentifiable.

**Prohibits.**
- A page-level `max-w-*` cap or a bespoke column wrapper instead of `ScreenAdaptiveView` + `page-container`; a loading, empty, or error branch rendered outside the page container.
- An ad-hoc borderless `bg-card`/`shadow-*` card instead of `.page-card`; a dark drop shadow for elevation.
- Rendering an untruncated title/name; a per-call-site `truncate` / `line-clamp` / `max-w-[…]` standing in for the shared classes, or an app's own copy of them; a truncated sole identifier whose full value is in neither its accessible name nor its title.

**References.** RULE-STD-FRONTEND-001, RULE-STD-FRONTEND-008, RULE-STD-FRONTEND-203.

### RULE-STD-FRONTEND-008 — Semantic classes over repeated inline Tailwind; ui-core built-ins not overridden per-instance
**Scope.** apps

**Rule.** Repeated appearance uses a semantic CSS class in `components.css`, not inline Tailwind duplicated across call sites. Components from `@ttt-productions/ui-core` already carry their built-in classes — do not add a `className` to a ui-core component unless deliberately overriding one specific instance. Ordinary styling lives in the layered app sheets (`layer(base)`), never in `overrides.css`; `brand.css` holds tokens only. A look only `<APP_NAME>` wants is made in `<APP_NAME>`'s own sheets, never by changing a package.

**Why.** Duplicated inline utility strings are the same value in many places (RULE-STD-ENG-002 drift); per-instance overrides of ui-core built-ins fork the shared component's look; a package changed for one app's look changes every other app's.

**Prohibits.**
- The same multi-utility Tailwind string repeated across components instead of a semantic class.
- A blanket `className` on a ui-core component that re-styles its built-in appearance for no single-instance reason.
- A class, rule, or selector in `brand.css` (tokens only).
- Changing a `@ttt-productions/*` package to alter an `<APP_NAME>`-only look.

**References.** RULE-STD-ENG-002; RULE-STD-FRONTEND-002, RULE-STD-FRONTEND-003; RULE-STD-ARCH-201.

### RULE-STD-FRONTEND-010 — Browser storage holds device-local state only, through guarded access
**Scope.** both

**Rule.** `localStorage` / `sessionStorage` hold only DEVICE-LOCAL state that has no server field. Every access tolerates a store that throws: a browser that blocks site data throws on the storage access itself, so reads fall back to "nothing saved" and writes never throw (hold the value in memory for the page's life). A stored value other open tabs act on — consent, a preference — stays consistent across tabs through the `storage` event.

**Apps:** keys come from the `<APP_DATA_PACKAGE>` storage-key contract, an account-durable preference's one authority is its server document (RULE-STD-ENG-002), and the only browser mirror of an account-durable value is the sanctioned optimistic mirror the app's addition names (the addition also lists the app's device-local state).

**Packages:** a package touches storage only with keys the consuming app supplies, never a hand-typed app key.

**Why.** An unguarded storage read inside a store snapshot the shell mounts crashes every route for a user whose browser blocks site data; a second browser copy of an account-level setting drifts from the account; and a tab that never hears another tab's consent withdrawal keeps collecting analytics.

**Prohibits.**
- A raw `localStorage` / `sessionStorage` access with no guard, in a store snapshot, an effect, or a handler.
- A browser-stored copy of an account-durable preference beyond the app's one sanctioned mirror; a hand-typed storage key where an `<APP_DATA_PACKAGE>` key exists; a hand-typed app storage key inside a generic package.
- A device-local store that other tabs act on and that ignores the `storage` event.

**References.** RULE-STD-ENG-002, RULE-STD-ENG-009; RULE-STD-FRONTEND-103, RULE-STD-FRONTEND-107, RULE-STD-FRONTEND-206; RULE-STD-ARCH-201; ttt-packages `docs/packages/theme-core.md` (the blocked-storage-tolerant store).
