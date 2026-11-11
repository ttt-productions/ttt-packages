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

### RULE-STD-FRONTEND-006 — State changes swap icons; destructive actions live in the one '…' menu; red lives only inside confirmation dialogs
**Scope.** apps

**Rule.** A state change swaps the ICON, never the color or variant (the app's addition names its icon pairs). On every member-facing screen, every destructive action on an item — delete, remove, close, hide, and the like — lives in the app's one shared "…" actions menu and opens its confirmation dialog from there; it never sits inline on the item. The item's secondary actions (a download, a report) sit in the same menu. Red/destructive is reserved for the confirm action **inside that dialog** and for urgency text. Admin actions stay in the app's admin actions.

**Admin pages are exempt from the "…" menu.** The "…" menu clause binds member-facing screens only. On a page of the app's admin area, a destructive action may sit inline on its row — a Delete or Remove button beside the item — and still opens its confirmation dialog, with red only on that dialog's confirm. The icon-swap and red clauses bind admin pages as written.

**Why.** Color-swap state is ambiguous across themes and collides with the app's affordance colors; icon-swap reads the same everywhere. An inline destructive control is one mis-tap from a consequential action wherever it sits and however it is colored; one menu per item puts every such action in one known place behind one more deliberate step.

**Prohibits.**
- A color/variant change to signal state (e.g. a green "success" toggle button); one icon used for two different actions.
- On a member-facing screen, a destructive control rendered inline on an item, in any color, instead of in the shared "…" menu.
- On any screen, admin pages included, a destructive action that runs without its confirmation dialog.
- A red destructive control anywhere but a dialog's confirm.
- A second "…" menu or a hand-built dropdown for an item's actions.

**References.** RULE-STD-FRONTEND-202.

### RULE-STD-FRONTEND-007 — One page column, one card recipe, truncation everywhere
**Scope.** apps

**Rule.** Every page wraps its content in `ScreenAdaptiveView` (ui-core) with the `page-container` class — a full-width single column that centers to a max-width on desktop; content fills it (no per-component `max-w-*` caps on page-level cards). Every branch of a page — loading, empty, and error included — renders inside that page container. A deliberate full-width exception exists only where the app's addition names it. Page-level content cards are ui-core's `Card` in its page-card variant, with `CardHeader`, `CardTitle`, and `CardContent` in their page-card variants — never ad-hoc `bg-card` + `shadow-xl` borderless cards; dark-theme elevation is lightening + faint border, never dark drop shadows. Every user-supplied title and name, and every block of user text cut to a few lines, renders through ui-core's `ClippedText` (one, two or three lines, or a name in two pieces), so long content never breaks layout. `ClippedText` draws theme-core's clip classes, which stay the one definition of the clip, and always keeps the full text in the element's title and accessible name.

**Why.** Consistent column, card, and truncation recipes keep every screen visually one system and stop long user content from breaking layout; a loading or error branch rendered outside the container jumps the layout, and a truncated name with no full value leaves the record unidentifiable.

**Prohibits.**
- A page-level `max-w-*` cap or a bespoke column wrapper instead of `ScreenAdaptiveView` + `page-container`; a loading, empty, or error branch rendered outside the page container.
- An ad-hoc borderless `bg-card`/`shadow-*` card, or a page card, header, title, or content built by putting card classes on a ui-core part, instead of the page-card variants; a dark drop shadow for elevation.
- Rendering an untruncated title/name; a clip class (`.single-line-truncate`, `.two-line-clamp`, `.three-line-clamp`) or a per-call-site `truncate` / `line-clamp` / `max-w-[…]` placed by hand instead of `ClippedText`, or an app's own copy of it.

**References.** RULE-STD-FRONTEND-001, RULE-STD-FRONTEND-008, RULE-STD-FRONTEND-203; ttt-packages `docs/packages/ui-core.md`.

### RULE-STD-FRONTEND-008 — Semantic classes over repeated inline Tailwind; a ui-core part's look is restyled only through its variants
**Scope.** apps

**Rule.** Repeated appearance uses a semantic CSS class in `components.css`, not inline Tailwind duplicated across call sites. A ui-core part owns its look: its built-in classes are Tailwind utilities, which outrank every stylesheet layer, so a stylesheet class that sets a property the part already sets to another value loses without a sign while it looks applied. A second standard look every app shares is a variant of that ui-core part, which replaces its built-in classes; its styling comes from the theme package's classes and each app's tokens. On a ui-core part a call site may add a layout class that sets only what the part does not set and a single-instance Tailwind override, never a stylesheet class that restyles what the part already styles: the theme package's spacing-between-children classes compose with every part, while its centering, clamp and truncation classes are for plain elements and hold on a part only where it sets none of their properties. A look only `<APP_NAME>` wants is `<APP_NAME>`'s own class on its own element or wrapper, made in its own sheets, never by changing a package. Ordinary styling lives in the layered app sheets (`layer(base)`), never in `overrides.css`; `brand.css` holds tokens only. The repo-guards `partRestyling` guard enforces the ui-core half; a reviewed exception is an entry in the app's guard config with its reason.

**Why.** Duplicated inline utility strings are the same value in many places (RULE-STD-ENG-002 drift); per-instance overrides of ui-core built-ins fork the shared component's look; a stylesheet class on a ui-core part that sets what the part already sets loses to the part's utility without a sign, so the screen shows a look nobody chose; a package changed for one app's look changes every other app's.

**Prohibits.**
- The same multi-utility Tailwind string repeated across components instead of a semantic class.
- A stylesheet class on a ui-core part that sets a property the part's built-in classes already set to another value; a shared look built that way instead of the part's variant.
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
