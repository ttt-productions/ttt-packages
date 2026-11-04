# A shared column table in ui-core, with apps supplying only their columns and rows

**What:** The sortable column table with presets, a view menu and a saved view moves from Q-Sports into `ui-core` as a generic table over any row type; an app supplies only its column catalog, its rows and its saved-view key.
**Severity:** medium
**Came from:** the Q-Sports 2.0 migration orchestrator, 2026-11-03, on DJ's instruction during area 6a (the guard suite), where the stats table's cast was fixed by keeping each sport's own row type through to the table.
**Trigger:** DJ pulls it in when he has the time.

## Why

DJ wants the table mechanism shared, with Q-Sports only making it stats. The table code is already
generic over its row, but it lives in one app, and its column types live in Q-Sports' application-data
package. A second app that needs a column table would build its own (RULE-STD-ENG-002,
RULE-STD-ENG-003). The workspace rule is that a mechanism both apps need lives here.

## As it is today (checked in the code, 2026-11-03)

- **The table**, in Q-Sports `src/components/stats-table/`: `stats-table.tsx` (the table, generic over
  `Row`), `view-menu.tsx` (choosing columns and presets), `view-state.ts` (layout, sorting, the
  stored view's schema), `use-stats-table-view.ts` (the saved view). It is built on ui-core's `Table`
  and `SortableTableHead`.
- **The column types**, in q-core `sports/column-catalog.ts`: `StatColumn<Row>`, `ColumnSort`,
  `ColumnPreset`, `ColumnCatalog<Row>` (presets or a default layout), `SortDirection`. Each sport's
  catalog is typed to its own parsed line (`SportColumnCatalogs<L>` in `sports/sport-adapter.ts`).
- **The app-only parts inside it:**
  - The per-game column: `perGame` on a column, `GamesPlayedRow`, `perGameAverage`, and
    `formatStatFigure`'s one-decimal rule for it.
  - The saved view keyed by `sportKey` and `tableType`.
  - Q-Sports' `LogoLockup` watermark under the table.
  - `view-state.ts`'s `hasGamesPlayed` check and its `PerGameColumn` cast.

## The work

**ttt-packages, one release:**
- **ui-core** gets the table, the view menu, the view state and the saved-view hook, all generic over
  `Row`, with no app vocabulary (RULE-STD-ARCH-201).
- **ui-core** gets the column types too: the column, sort, preset and catalog types from q-core's
  `column-catalog.ts`, named generically.
- **The per-game column becomes a generic derived column:** a column whose value is one column
  divided by another, shown with one decimal. q-core's sports state per-game as that.
- **Two things are supplied by the app:**
  - the saved-view storage key, from the app's own key builder
  - anything rendered under the table, through a slot, which is where Q-Sports' logo goes
- **The derived column needs no cast:** the derived-column check is typed, so `view-state.ts`'s
  casts go away.
- **q-core** keeps only each sport's catalogs, built on ui-core's types. The generic types leave it.
- **Docs and adoption:** `docs/packages/ui-core.md` says what the table owns. Adoption files go to
  both apps; ttt-prod's is install only until it has a table.

**Q-Sports, after the release:**
- `src/components/stats-table/` is deleted.
- Each stats page renders ui-core's table with the sport's catalog, its rows, its key builder and its
  logo in the slot.
- A person's saved view lives in their browser (q-core `statsTableViewStorageKey`). It keeps its key
  and shape, or the new table reads the old one once and falls back to the default layout.

**Done when:**
- the table lives in ui-core with no app vocabulary
- Q-Sports' stats pages use it, and its own table folder is gone
- q-core holds only the sports' catalogs
- both apps' adoption files are written
