import { perGameAverage } from './column-catalog.js';
import type { GamesPlayedRow, PerGameColumn, StatColumn } from './column-catalog.js';

export interface LifetimeSummaryTotal<Line> {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: (line: Line) => number;
}

export interface LifetimeSummaryAverage<Line> {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: (line: Line) => number | null;
}

export interface LifetimeSummary<Line> {
  readonly totals: readonly LifetimeSummaryTotal<Line>[];
  readonly averages: readonly LifetimeSummaryAverage<Line>[];
}

export function lifetimeSummaryFromColumns<Line extends GamesPlayedRow>(
  columns: readonly StatColumn<Line>[],
): LifetimeSummary<Line> {
  const totals = columns.map((column) => ({
    id: column.id,
    label: column.label,
    shortLabel: column.shortLabel,
    value: column.value,
  }));
  const averages = columns.flatMap((column) => {
    // Over a generic line the member's conditional type cannot be resolved; `Line` carries
    // `gamesPlayed`, so where the member exists it is a PerGameColumn.
    const perGame = column.perGame as PerGameColumn | undefined;
    if (!perGame) return [];
    return [
      {
        id: perGame.id,
        label: perGame.label,
        shortLabel: perGame.shortLabel,
        value: (line: Line) => perGameAverage(column.value(line), line.gamesPlayed),
      },
    ];
  });
  return { totals, averages };
}
