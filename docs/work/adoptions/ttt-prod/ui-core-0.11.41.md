# Adopt @ttt-productions/ui-core 0.11.41

**What:** ui-core gains variants for the shared looks theme-core classes restyled, and the shared "…" item actions menu.
**Severity:** medium

- **Package and version:** `@ttt-productions/ui-core` 0.11.41.
- **Release:** `./scripts/release-multiple.sh dev-standards theme-core ui-core repo-guards patch`.
- **What changed:**
  - Variants that carry theme-core's recipe class in place of the built-in utilities it lost to:
    `Card variant="page"`, `CardHeader variant="page" | "pageLeft"`, `CardTitle variant="page"`,
    `CardContent variant="page"`, `DialogTitle variant="page"`, `Label variant="caption" | "small" |
    "label"`, `SelectTrigger variant="filter"` (filter and sort selects), `Button size="action"`
    (`.primary-action-button`), `DropdownMenuContent variant="actions"` (`.app-dropdown-menu`).
    Defaults are unchanged. Button's `text-sm` moved from its base into each existing size.
  - The item actions menu, generic, from ttt-prod's `common-actions-menu.tsx`: `ActionsMenu`
    (`label`, `emptyLabel`), `ActionMenuItem`, `AsyncActionMenuItem` (its `onError` is required —
    pass the app's async-action capture), `OverlayActionItem` (also takes `pending`), `useActionsMenu`
    and the `OverlayRender` type. Report and admin-tools items stay app-side.
- **What the app must change:**
  - `src/components/shared/common-actions-menu.tsx` and `common-actions-menu-context.ts` become
    ui-core's: `CommonActionsMenu` → `ActionsMenu`, the generic item kinds import from ui-core,
    `ReportActionItem` and `AdminToolsMenuItem` use `useActionsMenu`. The items' redundant
    `app-dropdown-item` className goes (the item carries it built in).
  - Every part restyled with a recipe class takes its variant (the repo-guards `partRestyling` guard
    lists them once adopted): this is ttt-prod's item
    `docs/work/waiting-to-be-implemented/ui-core-parts-onto-variants.md`; moving the inline
    destructive actions into the menu is `destructive-actions-into-the-shared-menu.md`.
- **Done when:** The lockfile names `@ttt-productions/ui-core` 0.11.41 or later, the menu files
  import ui-core's shell, and the typechecks and touched tests pass.
