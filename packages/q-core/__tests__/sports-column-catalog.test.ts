import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  COLUMN_CATALOG_KEYS,
  SORT_DIRECTION_KEYS,
  perGameAverage,
  type ColumnCatalog,
  type ColumnCatalogKey,
  type ColumnPreset,
  type ColumnSort,
  type SortDirection,
  type StatColumn,
} from '../src/sports';

// A fixture sport, declared only here: no placeholder sport exists in q-core or the app.
interface FixtureSeasonLine {
  gamesPlayed: number;
  goals: number;
  goalsAgainst: number;
}

interface FixtureGameLine {
  goals: number;
  saves: number;
}

const seasonColumns: StatColumn<FixtureSeasonLine>[] = [
  { id: 'gamesPlayed', label: 'Games played', shortLabel: 'GP', value: (line) => line.gamesPlayed, sort: 'desc' },
  {
    id: 'goals',
    label: 'Goals',
    shortLabel: 'G',
    value: (line) => line.goals,
    perGame: { id: 'goalsPerGame', label: 'Goals per game', shortLabel: 'G/G' },
    sort: 'desc',
  },
  {
    id: 'goalsAgainst',
    label: 'Goals against',
    shortLabel: 'GA',
    value: (line) => line.goalsAgainst,
    perGame: { id: 'goalsAgainstPerGame', label: 'Goals against per game', shortLabel: 'GA/G' },
    sort: 'asc',
  },
];

const gameColumns: StatColumn<FixtureGameLine>[] = [
  { id: 'goals', label: 'Goals', shortLabel: 'G', value: (line) => line.goals, sort: 'desc' },
  { id: 'saves', label: 'Saves', shortLabel: 'SV', value: (line) => line.saves, sort: 'desc' },
];

const totals: ColumnPreset = { id: 'totals', label: 'Totals', columnIds: ['gamesPlayed', 'goals', 'goalsAgainst'] };
const perGame: ColumnPreset = {
  id: 'perGame',
  label: 'Per game',
  columnIds: ['gamesPlayed', 'goalsPerGame', 'goalsAgainstPerGame'],
};
const byGoals: ColumnSort[] = [{ columnId: 'goals', direction: 'desc' }];

const seasonCatalog: ColumnCatalog<FixtureSeasonLine> = {
  columns: seasonColumns,
  defaultSort: [...byGoals, { columnId: 'goalsAgainst', direction: 'asc' }],
  presets: [totals, perGame],
};

const gameCatalog: ColumnCatalog<FixtureGameLine> = {
  columns: gameColumns,
  defaultSort: byGoals,
  defaultLayout: ['goals', 'saves'],
};

describe('perGameAverage', () => {
  it('divides a total by games played, unrounded', () => {
    expect(perGameAverage(7, 2)).toBe(3.5);
    expect(perGameAverage(10, 3)).toBe(10 / 3);
  });

  it('is null at zero games played, never Infinity or NaN', () => {
    expect(perGameAverage(5, 0)).toBeNull();
    expect(perGameAverage(0, 0)).toBeNull();
    expectTypeOf(perGameAverage).returns.toEqualTypeOf<number | null>();
  });

  it('is zero for a zero total once a game has been played', () => {
    expect(perGameAverage(0, 4)).toBe(0);
  });

  it('gives a per-game column its figure from the column value and the line', () => {
    const goals = seasonColumns[1];
    const line: FixtureSeasonLine = { gamesPlayed: 4, goals: 10, goalsAgainst: 3 };
    expect(perGameAverage(goals.value(line), line.gamesPlayed)).toBe(2.5);
  });
});

describe('sort direction', () => {
  it('is ascending or descending, nothing else', () => {
    expect([...SORT_DIRECTION_KEYS]).toEqual(['asc', 'desc']);
    expectTypeOf<SortDirection>().toEqualTypeOf<'asc' | 'desc'>();
  });
});

describe('column catalog keys', () => {
  it('name exactly the three catalogs every sport declares', () => {
    expect([...COLUMN_CATALOG_KEYS]).toEqual(['playerTotals', 'gamePlayer', 'teamSeason']);
    expectTypeOf<ColumnCatalogKey>().toEqualTypeOf<'playerTotals' | 'gamePlayer' | 'teamSeason'>();
  });
});

// The type-level cases below are proven by the typecheck, which fails when an expected error stops
// occurring; at runtime they only construct the values.
describe('column catalog', () => {
  it('declares its default layout as its first preset, or as a default layout', () => {
    expect(seasonCatalog.presets?.[0]).toBe(totals);
    expect(seasonCatalog.defaultLayout).toBeUndefined();
    expect(gameCatalog.defaultLayout).toEqual(['goals', 'saves']);
    expect(gameCatalog.presets).toBeUndefined();
  });

  it('refuses a catalog declaring both layouts, neither, or an empty preset list', () => {
    // @ts-expect-error — presets and a default layout together
    const both: ColumnCatalog<FixtureGameLine> = { columns: gameColumns, defaultSort: byGoals, presets: [totals], defaultLayout: ['goals'] };
    // @ts-expect-error — no default layout at all
    const neither: ColumnCatalog<FixtureGameLine> = { columns: gameColumns, defaultSort: byGoals };
    // @ts-expect-error — a preset catalog names at least one preset, the default
    const noPresets: ColumnCatalog<FixtureGameLine> = { columns: gameColumns, defaultSort: byGoals, presets: [] };
    expect([both, neither, noPresets]).toHaveLength(3);
  });

  it('offers a per-game variant only on lines that carry games played', () => {
    // @ts-expect-error — a game line has no games played to average over
    const perGameOnGameLine: StatColumn<FixtureGameLine> = { id: 'goals', label: 'Goals', shortLabel: 'G', value: (line) => line.goals, perGame: { id: 'goalsPerGame', label: 'Goals per game', shortLabel: 'G/G' }, sort: 'desc' };
    expect(perGameOnGameLine.id).toBe('goals');
    expect(seasonColumns[1].perGame?.id).toBe('goalsPerGame');
  });

  it('refuses a first sort outside the two directions', () => {
    // @ts-expect-error — `up` is not a sort direction
    const sideways: StatColumn<FixtureGameLine> = { id: 'saves', label: 'Saves', shortLabel: 'SV', value: (line) => line.saves, sort: 'up' };
    expect(sideways.id).toBe('saves');
  });
});
