# Adopt @ttt-productions/dev-standards 0.0.25

**What:** RULE-STD-FRONTEND-007 and 008 say a ui-core part's look changes only through its variants; page cards are the page-card variants.
**Severity:** low
**Came from:** the Q-Sports stored-schemas finish and rulebook ttt-packages session

- **Package and version:** `@ttt-productions/dev-standards` 0.0.25. Adopt `dev-standards-0.0.21.md`
  to `dev-standards-0.0.24.md` first, or together.
- **Release:** `./scripts/release-multiple.sh dev-standards patch`.
- **What changed:**
  - RULE-STD-FRONTEND-007: page-level content cards are ui-core's `Card` in its page-card variant,
    with `CardHeader`, `CardTitle` and `CardContent` in their page-card variants; a page card built
    by putting card classes on a ui-core part is prohibited.
  - RULE-STD-FRONTEND-008 (retitled "…a ui-core part's look is restyled only through its
    variants"): a ui-core part's built-in classes are Tailwind utilities that outrank every
    stylesheet layer, so a stylesheet class that sets a property the part already sets to another
    value loses without a sign; a second shared look is a variant of the part; on a ui-core part a
    call site may add a layout class that sets only what the part does not set and a single-instance
    Tailwind override, never a stylesheet class that restyles what the part already styles.
  - `playbooks/crosswalk.md` carries the new title.
- **What the app must change:** Install. The variants, the `partRestyling` guard and the theme-core
  cleanup shipped in ui-core 0.11.41, theme-core 0.12.17 and repo-guards 0.1.48 (their adoption files
  here); ttt-prod's move onto them is its own item,
  `docs/work/waiting-to-be-implemented/ui-core-parts-onto-variants.md`. Until it lands, ttt-prod's
  page cards and restyled parts are the known gap that item closes.
- **Done when:** The lockfiles name `@ttt-productions/dev-standards` 0.0.25 or later.
