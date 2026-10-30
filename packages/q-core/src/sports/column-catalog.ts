export const SORT_DIRECTION_KEYS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTION_KEYS)[number];

export interface GamesPlayedRow {
  readonly gamesPlayed: number;
}

export interface PerGameColumn {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
}

export interface StatColumn<Row> {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: (row: Row) => number;
  readonly perGame?: [Row] extends [GamesPlayedRow] ? PerGameColumn : never;
  readonly sort: SortDirection;
}

export interface ColumnSort {
  readonly columnId: string;
  readonly direction: SortDirection;
}

export interface ColumnPreset {
  readonly id: string;
  readonly label: string;
  readonly columnIds: readonly string[];
}

export interface ColumnCatalogBase<Row> {
  readonly columns: readonly StatColumn<Row>[];
  readonly defaultSort: readonly ColumnSort[];
}

export interface PresetColumnCatalog<Row> extends ColumnCatalogBase<Row> {
  readonly presets: readonly [ColumnPreset, ...ColumnPreset[]];
  readonly defaultLayout?: never;
}

export interface DefaultLayoutColumnCatalog<Row> extends ColumnCatalogBase<Row> {
  readonly defaultLayout: readonly string[];
  readonly presets?: never;
}

export type ColumnCatalog<Row> = PresetColumnCatalog<Row> | DefaultLayoutColumnCatalog<Row>;

export const COLUMN_CATALOG_KEYS = ['playerTotals', 'gamePlayer', 'teamSeason'] as const;
export type ColumnCatalogKey = (typeof COLUMN_CATALOG_KEYS)[number];

export const GAMES_PLAYED_CATALOG_KEYS = [
  'playerTotals',
  'teamSeason',
] as const satisfies readonly ColumnCatalogKey[];
export type GamesPlayedCatalogKey = (typeof GAMES_PLAYED_CATALOG_KEYS)[number];

export function perGameAverage(total: number, gamesPlayed: number): number | null {
  return gamesPlayed === 0 ? null : total / gamesPlayed;
}
