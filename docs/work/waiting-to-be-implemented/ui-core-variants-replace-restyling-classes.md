# ui-core variants replace the theme classes that restyle its parts

**What:** Each shared look that today is a theme-core class put on a ui-core part becomes a ui-core
variant of that part; a repo-guards guard fails a stylesheet class that restyles a ui-core part; the
theme-core values the variants replace are removed.
**Severity:** medium
**Came from:** the Q-Sports rulebook conversion (RULE-STD-FRONTEND-007 / 008), talked through with DJ

## How it is today, and why it is wrong

- Both apps pin the layers `theme, base, components, utilities, overrides` and import every package
  and app sheet — theme-core's `components.css` included — into `layer(base)`. Tailwind's utilities
  layer sits above it.
- ui-core's parts carry their built-in look as Tailwind utilities (`CardHeader`'s `p-6`,
  `CardTitle`'s `text-2xl font-semibold`, `CardContent`'s `p-6 pt-0`, `Label`'s `text-sm font-bold`,
  `Button`'s size classes, `SelectTrigger`'s `h-10 … px-3 py-2`).
- So a theme-core class on a ui-core part that sets one of those properties to another value loses,
  silently: the screen shows ui-core's look while the code reads as if the recipe applied. Examples:
  `page-card-header` / `page-card-title` / `page-card-content` on the Card parts, `text-caption` /
  `text-small` / `text-label` on `Label`, `filter-select-trigger` / `sort-select-trigger` on
  `SelectTrigger`, `primary-action-button` on `Button`. theme-core already carries `!important`
  patches fighting it (`app-dropdown-item`).
- Only stylesheet classes lose. ui-core's `cn` is `tailwind-merge`, so a Tailwind utility at the
  call site does replace the built-in — a single-instance Tailwind override works.
- Layout classes compose: `stack-N`, `center-col`, `single-line-truncate` set nothing the part sets,
  or set it to the same value.
- repo-guards' "a semantic text class keeps its color against the same-named Tailwind utility"
  (`semanticTextCollision`, `src/modules/ui/cascade.ts`) catches a narrower relative: a sheet's
  `.text-X` color against Tailwind's same-named utility.
- RULE-STD-FRONTEND-007 and 008 already state the design below (dev-standards 0.0.25); this item
  builds what they name.

## The work (packages first, one release)

1. **ui-core variants.** Each shared look becomes a variant of its part that replaces the part's
   built-in classes instead of fighting them: the page-card variants of `Card`, `CardHeader`,
   `CardTitle` and `CardContent`; and a variant for each other family a restyling class serves
   today (the `Label` text looks, the filter and sort `SelectTrigger`, the primary action `Button`).
   `Button`, `Badge` and `Alert` already use `cva` variants; `Label` uses `cva` with only a base
   string, so its variants are new. A variant's styling comes from theme-core classes and each app's
   tokens, as ui-core's parts already use theme-core classes (`card-border`, `card-title`), so each
   app keeps its brand.
2. **The look of each variant is what the recipe meant** — the theme-core values that lose today
   (for example the page card's bigger bold title and its tighter phone padding), not the ui-core
   built-ins the screens show now. DJ verifies every look himself on the local dev stack.
3. **The repo-guards guard**, built on the cascade machinery the text-color guard uses: it reads each
   ui-core part's built-in classes from ui-core and fails when a stylesheet class on that part sets a
   property the built-ins set **to a different value** (the class would lose), naming the part, the
   class and the property. A Tailwind utility at the call site is not a finding, and neither is a
   class that sets the same value. Its reviewed exception is an entry in the app's guard config with
   its reason at the entry.
4. **A theme-core test** that its layout classes never set a property a ui-core part's built-ins set
   to a different value.
5. **theme-core cleanup.** The recipe values the variants now own, and the `!important` patches that
   fought the utilities, are removed.
6. **RULE-STD-FRONTEND-008** gains its guard sentence in the same release: "The repo-guards
   `<guard id>` guard enforces the ui-core half; a reviewed exception is an entry in the app's guard
   config with its reason." `playbooks/crosswalk.md` names the guard on RULE-STD-FRONTEND-008.
7. Adoption files for both apps; each app's move is its own item: ttt-prod's
   `docs/work/waiting-to-be-implemented/ui-core-parts-onto-variants.md`, Q-Sports'
   `docs/work/projects/migration-2.0/code-changes/ui-core-parts-onto-variants.md`.

**How to find every site:** a theme-core class that is not a layout class, passed as `className` to
a ui-core component, in either app; once the guard ships, the guard lists them.

**Done when:** every shared look a restyling class served is a ui-core variant; the guard and the
theme-core test run green in ttt-packages; the replaced theme-core values are gone; RULE-STD-FRONTEND-008
names the guard; both apps' adoption files are written.
