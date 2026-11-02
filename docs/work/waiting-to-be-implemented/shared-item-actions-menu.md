# The one "…" actions menu becomes a shared package component

**What:** ttt-prod's `CommonActionsMenu` shell moves into ttt-packages, generic, so both apps use one
"…" menu and each app supplies its items.
**Severity:** medium
**Came from:** the Q-Sports rulebook conversion (RULE-STD-FRONTEND-006), talked through with DJ

## Why

RULE-STD-FRONTEND-006 (dev-standards 0.0.26): every destructive action on an item — delete, remove,
close, hide, and the like — and the item's secondary actions (a download, a report) live in the
app's one shared "…" actions menu; a destructive action opens its confirmation dialog from there and
never sits inline. Both apps need that menu, and only ttt-prod has one today, so it is one shared
component rather than a second copy (RULE-STD-ENG-002, RULE-STD-ENG-003).

## How ttt-prod does it today

`src/components/shared/common-actions-menu.tsx` (with `common-actions-menu-context.tsx`): a ui-core
`DropdownMenu` behind a "…" trigger, and the generic item kinds `ActionMenuItem`,
`AsyncActionMenuItem` and `OverlayActionItem`. An overlay item renders its dialog in an overlay slot
that is a sibling of the menu, because the default-modal Radix `DropdownMenu` sets
`pointer-events: none` on the page and closing it unmounts its content subtree. ttt-prod's own items
sit beside them: `ReportActionItem` (report-core) and the admin-tools entry. The conversation files
panel (Download, Report file, Delete file) and the hall library item (Report, Hide this work) show
the mix.

## The work

- The generic shell — the trigger, the menu, the overlay slot and its context, and the generic item
  kinds — moves into ttt-packages with no app names, paths, copy or policy (RULE-STD-ARCH-201); each
  app supplies its items and labels. Which package hosts it is settled with DJ when it is built
  (ui-core owns the `DropdownMenu` it wraps).
- Report and admin-tools items stay app-side (ttt-prod's report item is report-core's).
- Tests for the shell: a destructive overlay item's dialog survives the menu closing, and the
  menu's keyboard and focus behavior (RULE-STD-FRONTEND-203).
- Adoption files for both apps; each app's move is its own item: ttt-prod's
  `docs/work/waiting-to-be-implemented/destructive-actions-into-the-shared-menu.md`, Q-Sports'
  `docs/work/projects/migration-2.0/code-changes/destructive-actions-into-the-shared-menu.md`.

**Done when:** the shell is released, documented in `docs/packages/`, and green in
`npm run test:quiet`, and both apps' adoption files are written.
