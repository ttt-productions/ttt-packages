import { describe, it, expect } from 'vitest';
import { BASKETBALL_FANTASY_POINT_WEIGHTS } from '../src/constants/sports';
import {
  COLUMN_CATALOG_KEYS,
  perGameAverage,
  type ColumnCatalog,
  type PerGameColumn,
} from '../src/sports/column-catalog';
import { COLUMN_CATALOG_LINE_KINDS, type AnySportAdapter } from '../src/sports/sport-adapter';
import {
  GAMES_PLAYED_COLUMN,
  TEAM_SEASON_BASE_COLUMN,
  TEAM_SEASON_BASE_COLUMNS,
} from '../src/sports/shared-columns';
import { SPORT_ADAPTERS, SPORT_ADAPTER_LIST } from '../src/sports/registry';
import { basketballFantasyPoints } from '../src/sports/basketball-scoring';
import { LEAGUE_TYPE_KEYS, type LeagueType } from '../src/types/sports';
import type { StatLineKind } from '../src/types/stats';

const [BASKETBALL, CURLING, FOOTBALL] = LEAGUE_TYPE_KEYS;

// A stored line of every kind each sport keeps; a kind the sport does not keep has none.
const FIXTURE_LINES = {
  Basketball: {
    gamePlayer: { points: 21, rebounds: 7, assists: 4, fantasyPoints: 39.5 },
    membershipRow: { gamesPlayed: 6, points: 84, rebounds: 30, assists: 12, fantasyPoints: 153 },
    lifetime: { gamesPlayed: 40, points: 600, rebounds: 210, assists: 95, fantasyPoints: 1105 },
    hallOfFame: { gamesPlayed: 40, points: 600, rebounds: 210, assists: 95, fantasyPoints: 1105 },
    gameTeam: { score: 58, timeouts: 3 },
    teamSeason: {
      gamesPlayed: 6,
      wins: 4,
      losses: 1,
      ties: 1,
      pointsFor: 320,
      pointsAgainst: 290,
      rebounds: 180,
      assists: 70,
    },
  },
  Curling: {
    membershipRow: { gamesPlayed: 5 },
    lifetime: { gamesPlayed: 12 },
    gameTeam: { score: 7, roundScores: [1, 0, 0, 2, 0, 0, 3, 0, 1, null, null, null, null, null] },
    teamSeason: { gamesPlayed: 5, wins: 3, losses: 2, ties: 0, pointsFor: 34, pointsAgainst: 29 },
  },
  Football: {
    membershipRow: { gamesPlayed: 4 },
    lifetime: { gamesPlayed: 9 },
    gameTeam: { score: 27 },
    teamSeason: { gamesPlayed: 4, wins: 2, losses: 1, ties: 1, pointsFor: 88, pointsAgainst: 70 },
  },
} satisfies Record<LeagueType, Partial<Record<StatLineKind, object>>>;

const fixtureLine = (leagueType: LeagueType, kind: StatLineKind): object | undefined =>
  (FIXTURE_LINES[leagueType] as Partial<Record<StatLineKind, object>>)[kind];

const perGameOf = (column: { perGame?: unknown }) => column.perGame as PerGameColumn | undefined;

/** Every id a catalog offers: each column's, and each per-game variant's. */
function layoutIds(catalog: ColumnCatalog<never>): string[] {
  return catalog.columns.flatMap((column) => {
    const perGame = perGameOf(column);
    return perGame ? [column.id, perGame.id] : [column.id];
  });
}

const catalogsOf = (adapter: AnySportAdapter) =>
  COLUMN_CATALOG_KEYS.map((key) => [key, adapter.columns[key] as ColumnCatalog<never>] as const);

describe('every sport declares its three catalogs', () => {
  it('keys each adapter\'s catalogs by exactly the catalog keys', () => {
    for (const adapter of SPORT_ADAPTER_LIST) {
      expect(Object.keys(adapter.columns).sort()).toEqual([...COLUMN_CATALOG_KEYS].sort());
    }
  });

  it('reads each catalog\'s rows from a line kind', () => {
    expect(COLUMN_CATALOG_LINE_KINDS).toEqual({
      playerTotals: 'membershipRow',
      gamePlayer: 'gamePlayer',
      teamSeason: 'teamSeason',
    });
  });
});

describe.each([...LEAGUE_TYPE_KEYS])('the %s catalogs', (leagueType) => {
  const adapter: AnySportAdapter = SPORT_ADAPTERS[leagueType];

  it('give every column and per-game variant a unique id', () => {
    for (const [, catalog] of catalogsOf(adapter)) {
      const ids = layoutIds(catalog);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('offer a per-game variant only over rows that carry games played', () => {
    const gamePlayer = adapter.columns.gamePlayer as ColumnCatalog<never>;
    expect(gamePlayer.columns.every((column) => perGameOf(column) === undefined)).toBe(true);
  });

  it('read every figure from a row that parses under the sport\'s line schema', () => {
    for (const [key, catalog] of catalogsOf(adapter)) {
      const kind = COLUMN_CATALOG_LINE_KINDS[key];
      const row = fixtureLine(leagueType, kind);
      if (catalog.columns.length === 0) {
        expect(row).toBeUndefined();
        continue;
      }
      expect(adapter.lineSchemas[kind].safeParse(row).success).toBe(true);
      for (const column of catalog.columns) {
        const value = (column.value as (line: object) => number)(row as object);
        expect(Number.isFinite(value), `${key}.${column.id}`).toBe(true);
      }
    }
  });

  it('sort by default only on their own columns', () => {
    for (const [, catalog] of catalogsOf(adapter)) {
      const ids = new Set(layoutIds(catalog));
      for (const sort of catalog.defaultSort) expect(ids.has(sort.columnId)).toBe(true);
    }
  });

  it('lay out by default, and in every preset, only their own columns', () => {
    for (const [, catalog] of catalogsOf(adapter)) {
      const ids = new Set(layoutIds(catalog));
      const layouts = catalog.presets ? catalog.presets.map((preset) => preset.columnIds) : [catalog.defaultLayout];
      for (const layout of layouts) {
        for (const id of layout) expect(ids.has(id), id).toBe(true);
        expect(new Set(layout).size).toBe(layout.length);
      }
      if (catalog.presets) {
        const presetIds = catalog.presets.map((preset) => preset.id);
        expect(new Set(presetIds).size).toBe(presetIds.length);
      }
    }
  });

  it('put games played in the player-totals and standings catalogs, with no per-game variant anywhere', () => {
    for (const key of ['playerTotals', 'teamSeason'] as const) {
      const catalog = adapter.columns[key] as ColumnCatalog<never>;
      expect(catalog.columns.map((column) => column.id)).toContain(GAMES_PLAYED_COLUMN.id);
    }
    for (const [, catalog] of catalogsOf(adapter)) {
      const gamesPlayed = catalog.columns.find((column) => column.id === GAMES_PLAYED_COLUMN.id);
      if (gamesPlayed) expect(perGameOf(gamesPlayed)).toBeUndefined();
    }
  });

  it('build standings on the shared base, in its order', () => {
    const teamSeason = adapter.columns.teamSeason as ColumnCatalog<never>;
    expect(teamSeason.columns.slice(0, TEAM_SEASON_BASE_COLUMNS.length)).toEqual(TEAM_SEASON_BASE_COLUMNS);
  });

  it('show a lifetime summary whose figures read a stored lifetime line', () => {
    const line = fixtureLine(leagueType, 'lifetime') as { gamesPlayed: number };
    expect(adapter.lineSchemas.lifetime.safeParse(line).success).toBe(true);
    const { totals, averages } = adapter.display.lifetimeSummary as unknown as {
      totals: { id: string; value: (line: object) => number }[];
      averages: { id: string; value: (line: object) => number | null }[];
    };
    expect(totals[0].id).toBe(GAMES_PLAYED_COLUMN.id);
    for (const total of totals) expect(Number.isFinite(total.value(line))).toBe(true);
    for (const average of averages) {
      const column = (adapter.columns.playerTotals as ColumnCatalog<never>).columns.find(
        (candidate) => perGameOf(candidate)?.id === average.id,
      );
      expect(column, average.id).toBeDefined();
      const total = totals.find((candidate) => candidate.id === column?.id);
      expect(average.value(line)).toBe(perGameAverage(total?.value(line) ?? Number.NaN, line.gamesPlayed));
      expect(average.value({ ...line, gamesPlayed: 0 })).toBeNull();
    }
  });
});

describe('basketball columns', () => {
  const { playerTotals, gamePlayer, teamSeason } = SPORT_ADAPTERS[BASKETBALL].columns;

  it('offers the Totals preset, the default, then the Per game preset', () => {
    expect(playerTotals.presets?.map((preset) => [preset.id, preset.label, preset.columnIds])).toEqual([
      ['totals', 'Totals', ['gamesPlayed', 'points', 'rebounds', 'assists', 'fantasyPoints']],
      ['perGame', 'Per game', ['gamesPlayed', 'pointsPerGame', 'reboundsPerGame', 'assistsPerGame', 'fantasyPointsPerGame']],
    ]);
    expect(playerTotals.defaultLayout).toBeUndefined();
    expect(playerTotals.defaultSort).toEqual([{ columnId: 'points', direction: 'desc' }]);
  });

  it('labels each player figure the way the tables show it', () => {
    expect(playerTotals.columns.map((column) => [column.shortLabel, perGameOf(column)?.shortLabel ?? null])).toEqual([
      ['GP', null],
      ['PTS', 'PPG'],
      ['REB', 'RPG'],
      ['AST', 'APG'],
      ['FP', 'FP/G'],
    ]);
  });

  it("reads FP from the row's stored fantasyPoints, never computing it", () => {
    const fantasyPoints = playerTotals.columns.find((column) => column.id === 'fantasyPoints');
    const row = { ...FIXTURE_LINES.Basketball.membershipRow, fantasyPoints: 1234 };
    expect(fantasyPoints?.value(row)).toBe(1234);
  });

  it('shows points, rebounds, assists, and FP on the game page, by points', () => {
    expect(gamePlayer.defaultLayout).toEqual(['points', 'rebounds', 'assists', 'fantasyPoints']);
    expect(gamePlayer.defaultSort).toEqual([{ columnId: 'points', direction: 'desc' }]);
  });

  it('opens standings on W, L, PF, PA, +/-, REB, AST, ranked by wins, then fewest losses, then differential', () => {
    expect(teamSeason.defaultLayout).toEqual([
      'wins',
      'losses',
      'pointsFor',
      'pointsAgainst',
      'pointDifferential',
      'rebounds',
      'assists',
    ]);
    expect(teamSeason.defaultSort).toEqual([
      { columnId: 'wins', direction: 'desc' },
      { columnId: 'losses', direction: 'asc' },
      { columnId: 'pointDifferential', direction: 'desc' },
    ]);
    expect(teamSeason.columns.slice(TEAM_SEASON_BASE_COLUMNS.length).map((column) => column.id)).toEqual([
      'rebounds',
      'assists',
    ]);
  });

  it('summarizes a lifetime as GP, PTS, REB, AST, FP over PPG, RPG, APG, FP/G', () => {
    const { totals, averages } = SPORT_ADAPTERS[BASKETBALL].display.lifetimeSummary;
    expect(totals.map((figure) => figure.shortLabel)).toEqual(['GP', 'PTS', 'REB', 'AST', 'FP']);
    expect(averages.map((figure) => figure.shortLabel)).toEqual(['PPG', 'RPG', 'APG', 'FP/G']);
    const line = FIXTURE_LINES.Basketball.lifetime;
    expect(averages[0].value(line)).toBe(line.points / line.gamesPlayed);
    expect(averages[3].value(line)).toBe(line.fantasyPoints / line.gamesPlayed);
  });
});

describe.each([
  [CURLING, ['wins', 'losses', 'ties', 'pointsFor'], 'pointsFor'],
  [FOOTBALL, ['wins', 'losses', 'ties', 'pointsFor', 'pointsAgainst'], 'pointDifferential'],
] as const)('%s columns', (leagueType, standingsLayout, thirdTiebreak) => {
  const adapter: AnySportAdapter = SPORT_ADAPTERS[leagueType];

  it('counts games played only, with no presets and no player game table', () => {
    const playerTotals = adapter.columns.playerTotals as ColumnCatalog<never>;
    expect(playerTotals.columns.map((column) => column.id)).toEqual(['gamesPlayed']);
    expect(playerTotals.presets).toBeUndefined();
    expect(playerTotals.defaultLayout).toEqual(['gamesPlayed']);
    expect(playerTotals.defaultSort).toEqual([{ columnId: 'gamesPlayed', direction: 'desc' }]);
    expect((adapter.columns.gamePlayer as ColumnCatalog<never>).columns).toEqual([]);
  });

  it('opens standings on its own layout and standings order, with no extras beyond the base', () => {
    const teamSeason = adapter.columns.teamSeason as ColumnCatalog<never>;
    expect(teamSeason.columns).toEqual(TEAM_SEASON_BASE_COLUMNS);
    expect(teamSeason.defaultLayout).toEqual(standingsLayout);
    expect(teamSeason.defaultSort).toEqual([
      { columnId: 'wins', direction: 'desc' },
      { columnId: 'losses', direction: 'asc' },
      { columnId: thirdTiebreak, direction: 'desc' },
    ]);
  });

  it('summarizes a lifetime as games played, with no averages line', () => {
    const { totals, averages } = adapter.display.lifetimeSummary;
    expect(totals.map((figure) => figure.id)).toEqual(['gamesPlayed']);
    expect(averages).toEqual([]);
  });
});

describe('the standings base', () => {
  it('holds GP, W, L, T, PF, PA, and the differential, in that order', () => {
    expect(TEAM_SEASON_BASE_COLUMNS.map((column) => [column.shortLabel, column.sort])).toEqual([
      ['GP', 'desc'],
      ['W', 'desc'],
      ['L', 'asc'],
      ['T', 'desc'],
      ['PF', 'desc'],
      ['PA', 'asc'],
      ['+/-', 'desc'],
    ]);
  });

  it('offers per-game variants of points for and against only', () => {
    expect(TEAM_SEASON_BASE_COLUMNS.filter((column) => perGameOf(column)).map((column) => column.id)).toEqual([
      'pointsFor',
      'pointsAgainst',
    ]);
  });

  it('derives the differential from points for and against, storing nothing', () => {
    const line = FIXTURE_LINES.Football.teamSeason;
    expect(TEAM_SEASON_BASE_COLUMN.pointDifferential.value(line)).toBe(18);
    expect(TEAM_SEASON_BASE_COLUMN.pointDifferential.value({ ...line, pointsFor: 60 })).toBe(-10);
  });
});

describe('basketball fantasy points', () => {
  it('weighs points 1, rebounds 1.5, and assists 2', () => {
    expect(BASKETBALL_FANTASY_POINT_WEIGHTS).toEqual({ points: 1, rebounds: 1.5, assists: 2 });
    expect(basketballFantasyPoints({ points: 21, rebounds: 7, assists: 4 })).toBe(39.5);
    expect(basketballFantasyPoints({ points: 0, rebounds: 0, assists: 0 })).toBe(0);
  });

  it('sums across games exactly: FP of summed counters equals the sum of each game\'s FP', () => {
    const games = [
      { points: 13, rebounds: 5, assists: 1 },
      { points: 8, rebounds: 3, assists: 6 },
      { points: 30, rebounds: 11, assists: 0 },
    ];
    const summed = games.reduce(
      (total, game) => ({
        points: total.points + game.points,
        rebounds: total.rebounds + game.rebounds,
        assists: total.assists + game.assists,
      }),
      { points: 0, rebounds: 0, assists: 0 },
    );
    const perGame = games.reduce((total, game) => total + basketballFantasyPoints(game), 0);
    expect(basketballFantasyPoints(summed)).toBe(perGame);
  });

  it('matches the fantasy points the fixture lines store', () => {
    for (const kind of ['gamePlayer', 'membershipRow', 'lifetime', 'hallOfFame'] as const) {
      const line = FIXTURE_LINES.Basketball[kind];
      expect(line.fantasyPoints).toBe(basketballFantasyPoints(line));
    }
  });
});
