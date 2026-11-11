# Adopt @ttt-productions/dev-standards 0.0.39

**What:** A new shared rule says data is read only when what shows it is shown: tabs, collapsed sections, dialogs, menus and pickers read when they open, and nothing reads ahead of the person.
**Severity:** medium

- **Package and version:** `@ttt-productions/dev-standards` 0.0.39.
- **Release:** `./scripts/release-multiple.sh theme-core ui-core mobile-core firebase-helpers query-core q-core site-core dev-standards repo-guards patch`.
- **What changed:** text only.
  - RULE-STD-FRONTEND-113 (`rules/frontend/data-and-callable-access.md`, scope both): a read starts
    only when something on screen needs its answer. A tab's data is read when the tab is selected,
    a collapsed section's when it opens, a dialog's, menu's or picker's when it opens — never when
    the page loads. What is not shown holds no read and no listener. The only reads made before
    their content shows are a read that decides whether a tab, section, control or line exists
    (in the page's gate, and a count or flag, never the list behind the tab) and a read something
    already on screen also uses. No prefetch, on hover or for a tab, dialog or page not yet opened,
    outside a reviewed entry in the app's guard config with its reason. The repo-guards
    `readsOnlyWhenShown` guard enforces the prefetch and `forceMount` halves.
  - RULE-STD-FRONTEND-007 now requires ui-core's `ClippedText` for every user-supplied title,
    name and few-line text block. ttt-prod meets it once every clip class in its app code is
    swapped onto ui-core's `ClippedText`.
  - The performance-audit playbook gains step 12, which runs that guard's two checks and reviews
    every tab, collapsible, dialog, sheet, popover and menu content; the crosswalk maps the rule to
    that step and the guard.
- **What the app must change:** the install, then:
  - Check ttt-prod's pages against the rule: every tab, collapsed section, dialog, menu and picker
    reads only when it opens (its hook called inside its content, never by the page or row that
    holds it closed), a live listener detaches when its tab, section or dialog closes, a read that
    decides whether a tab exists is a count or flag in the page's gate, and nothing prefetches
    outside a reviewed entry. Each page that breaks it is fixed, or becomes a work item.
  - ttt-prod's own rulebook gains a "ttt-prod additions" entry under RULE-STD-FRONTEND-113 in its
    `docs/engineering-rules/frontend/data-and-callable-access.md`, naming the guard titles that
    enforce it in its suite: "nothing reads ahead of the person outside a reviewed entry" and
    "content that is not shown is never kept mounted", and where its reviewed reads ahead are kept
    (the `readsOnlyWhenShown.readsAhead` list in its guard config).
- **Done when:** the lockfile names `@ttt-productions/dev-standards` 0.0.39 or later, ttt-prod's
  rulebook carries the addition, and performance-audit step 12 passes in ttt-prod.
