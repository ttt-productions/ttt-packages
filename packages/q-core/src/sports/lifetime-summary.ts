// The profile's lifetime summary for one sport: its totals, and directly beneath them its per-game
// averages. It is not a stats table — no View menu, no hidden figures — but it shows the same
// figures the sport's player-totals table offers, with the same labels, so each is declared once.

import { perGameAverage } from './column-catalog.js';
import type { GamesPlayedRow, PerGameColumn, StatColumn } from './column-catalog.js';

export interface LifetimeSummaryTotal<Line> {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: (line: Line) => number;
}

/** A per-game average, `null` at zero games played. */
export interface LifetimeSummaryAverage<Line> {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly value: (line: Line) => number | null;
}

export interface LifetimeSummary<Line> {
  readonly totals: readonly LifetimeSummaryTotal<Line>[];
  /** Empty for a sport that counts games played only: its summary has no averages line. */
  readonly averages: readonly LifetimeSummaryAverage<Line>[];
}

/**
 * The summary a sport's player-totals columns describe: every column's total, and the per-game
 * variant of every column that has one, through `perGameAverage` over the line's games played.
 */
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
