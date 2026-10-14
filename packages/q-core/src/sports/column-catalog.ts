// The column contract the one stats table renders. The table knows nothing about a sport: it takes
// a catalog of these columns and rows of the catalog's line type, and every per-game figure it
// shows comes from `perGameAverage`.

export const SORT_DIRECTION_KEYS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTION_KEYS)[number];

/** A line that can be averaged per game. */
export interface GamesPlayedRow {
  readonly gamesPlayed: number;
}

/** A column's per-game variant. Its own id lets a layout show it beside the total or instead of it. */
export interface PerGameColumn {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
}

export interface StatColumn<Row> {
  /** Presets, default layouts, and a table's View state name the column by this id. */
  readonly id: string;
  /** The full label: wide density and the accessible name. */
  readonly label: string;
  /** The header's label in compact and regular density (PTS). */
  readonly shortLabel: string;
  /** A stored field of the row or a derivation over it; nothing is stored for a column. */
  readonly value: (row: Row) => number;
  /**
   * Offered only where the rows carry `gamesPlayed`; its figure is
   * `perGameAverage(value(row), row.gamesPlayed)`. On any other row type the member is `never`.
   */
  readonly perGame?: [Row] extends [GamesPlayedRow] ? PerGameColumn : never;
  /** The direction of the column's first sort: `desc`, or `asc` where fewer is better. */
  readonly sort: SortDirection;
}

/** One tiebreak of a catalog's default order. */
export interface ColumnSort {
  readonly columnId: string;
  readonly direction: SortDirection;
}

/** A named column set the View menu offers as one tap. `columnIds` may name per-game ids. */
export interface ColumnPreset {
  readonly id: string;
  readonly label: string;
  readonly columnIds: readonly string[];
}

export interface ColumnCatalogBase<Row> {
  /** Catalog order: where a Custom layout inserts a column it has never seen. */
  readonly columns: readonly StatColumn<Row>[];
  readonly defaultSort: readonly ColumnSort[];
}

/** A catalog whose coded default layout is its first preset. */
export interface PresetColumnCatalog<Row> extends ColumnCatalogBase<Row> {
  readonly presets: readonly [ColumnPreset, ...ColumnPreset[]];
  readonly defaultLayout?: never;
}

/** A catalog with no presets: its coded default layout is the ordered visible column ids. */
export interface DefaultLayoutColumnCatalog<Row> extends ColumnCatalogBase<Row> {
  readonly defaultLayout: readonly string[];
  readonly presets?: never;
}

// The `never` members make a catalog that declares both `presets` and `defaultLayout`, or neither,
// a type error: the table must never have to choose between two default layouts.
export type ColumnCatalog<Row> = PresetColumnCatalog<Row> | DefaultLayoutColumnCatalog<Row>;

// The catalogs every sport declares, one per kind of stats table: `playerTotals` (league player
// rankings, the team page, the hall of fame), `gamePlayer` (the game page), `teamSeason`
// (standings — its `defaultSort` is the sport's standings order, which the rank and the playoff line
// follow). A stats table names the catalog it renders by this key.
export const COLUMN_CATALOG_KEYS = ['playerTotals', 'gamePlayer', 'teamSeason'] as const;
export type ColumnCatalogKey = (typeof COLUMN_CATALOG_KEYS)[number];

// The catalogs whose rows carry games played, so a per-game column can average them. A game's player
// line counts one game, so `gamePlayer` is not among them.
export const GAMES_PLAYED_CATALOG_KEYS = ['playerTotals', 'teamSeason'] as const satisfies readonly ColumnCatalogKey[];
export type GamesPlayedCatalogKey = (typeof GAMES_PLAYED_CATALOG_KEYS)[number];

/** The one per-game derivation: every per-game figure the app shows comes from here. */
export function perGameAverage(total: number, gamesPlayed: number): number | null {
  return gamesPlayed === 0 ? null : total / gamesPlayed;
}
