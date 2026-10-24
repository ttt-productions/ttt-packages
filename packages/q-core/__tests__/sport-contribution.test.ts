// What a completed game adds to every derived destination, and who it credits a game played
// (SPORT-201, SPORT-204, SPORT-207, SPORT-208): per team the standings line from the two scores, per
// roster entry its row credited to the team in its key, per real person the sum of their rows.
// Expected values are worked by hand from those rules and the FP weights (points 1, rebounds 1.5,
// assists 2), never read back from the code.

import { describe, expect, it } from 'vitest';
import { MAX_CURLING_ROUND_POINTS, STAT_HISTORY_PAGE_SIZE } from '../src/constants/sports.js';
import type { GameStatEvent } from '../src/doc-schemas/game-stats.js';
import type { BasketballGameStats } from '../src/doc-schemas/sport-game.js';
import { buildGameRosterPlayerId, parseGameRosterPlayerId } from '../src/ids/compound-ids.js';
import {
  applyStatLineDelta,
  sumGameContributions,
  type FinalizedGame,
} from '../src/sports/contribution.js';
import {
  buildFinalizedRecordPages,
  finalizedGameFromRecord,
  readFinalizedRecord,
} from '../src/sports/finalized-record.js';
import { gameScoreMirror } from '../src/sports/score-mirror.js';
import { getSportAdapter } from '../src/sports/registry.js';
import { playedWeeks, seasonRankingRows, weekRankingRows } from '../src/sports/rankings.js';
import { rollupDifferences } from '../src/sports/rollup-check.js';
import {
  CURLING_ROUND_SCORE_EVENT_TYPE,
  FOOTBALL_SCORE_EVENT_TYPE_KEYS,
} from '../src/types/sports.js';
import { higherTeamRole } from '../src/types/unions.js';

const A = 'team-a';
const B = 'team-b';
const GHOST = 'ghost_1760000000000_abcd';
const entry = (teamId: string, userId: string) => buildGameRosterPlayerId(teamId, userId);

const basketball = getSportAdapter('Basketball');
const curling = getSportAdapter('Curling');
const football = getSportAdapter('Football');

// A 10 – B 8. p1 scores 6 with 2 rebounds and an assist; p2 is present and records nothing; p3 is
// marked absent yet scored 4; `both` is rostered on both teams, a rebound for A and two assists for
// B; a ghost scores B's 8.
const basketballStats: BasketballGameStats = {
  teamStats: { [A]: { score: 10, timeouts: 1 }, [B]: { score: 8, timeouts: 0 } },
  playerStats: {
    [entry(A, 'p1')]: { points: 6, rebounds: 2, assists: 1, fantasyPoints: 11 },
    [entry(A, 'p3')]: { points: 4, rebounds: 0, assists: 0, fantasyPoints: 4 },
    [entry(A, 'both')]: { points: 0, rebounds: 1, assists: 0, fantasyPoints: 1.5 },
    [entry(B, GHOST)]: { points: 8, rebounds: 0, assists: 0, fantasyPoints: 8 },
    [entry(B, 'both')]: { points: 0, rebounds: 0, assists: 2, fantasyPoints: 4 },
  },
};
const basketballRoster = [
  entry(A, 'both'),
  entry(A, 'p1'),
  entry(A, 'p2'),
  entry(A, 'p3'),
  entry(B, 'both'),
  entry(B, GHOST),
].sort();
const basketballAbsent = [entry(A, 'p3')];

function basketballGame(): FinalizedGame {
  return {
    leagueType: 'Basketball',
    teamIds: [A, B],
    stats: basketballStats,
    rosterPlayerIds: basketballRoster,
    absentRosterPlayerIds: basketballAbsent,
    nonScoringRosterPlayerIds: basketball.participation(
      basketballStats,
      basketballRoster,
      basketballAbsent,
    ),
  };
}

describe('participation — the games-played decision finalize stores', () => {
  it('in basketball, withholds a game played from an absent entry and from a present one with no points, rebounds, or assists', () => {
    expect(basketball.participation(basketballStats, basketballRoster, basketballAbsent)).toEqual(
      [entry(A, 'p2'), entry(A, 'p3')].sort(),
    );
  });

  it('in basketball, credits a present entry with rebounds only — zero points alone is not exclusion', () => {
    expect(basketball.participation(basketballStats, [entry(A, 'both')], [])).toEqual([]);
  });

  it.each([
    ['Curling', curling],
    ['Football', football],
  ] as const)(
    'in %s, never calls a present entry non-scoring, whatever its team scored',
    (_label, adapter) => {
      const stats = adapter.emptyStats({ teamIds: [A, B] });
      expect(adapter.participation(stats, [entry(A, 'x'), entry(A, 'y')], [entry(A, 'y')])).toEqual(
        [],
      );
    },
  );
});

describe('contribution — basketball', () => {
  const contribution = basketball.contribution(basketballGame());

  it("decides each team's result from the two scores, with rebounds and assists summed from its own lines and no FP", () => {
    expect(contribution.teamLines[A]).toEqual({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      ties: 0,
      pointsFor: 10,
      pointsAgainst: 8,
      rebounds: 3,
      assists: 1,
    });
    expect(contribution.teamLines[B]).toEqual({
      gamesPlayed: 1,
      wins: 0,
      losses: 1,
      ties: 0,
      pointsFor: 8,
      pointsAgainst: 10,
      rebounds: 0,
      assists: 2,
    });
  });

  it('credits each entry its row on the team in its key, FP derived, an absent scorer counting stats but no game', () => {
    expect(contribution.membershipRows).toEqual({
      [entry(A, 'p1')]: { gamesPlayed: 1, points: 6, rebounds: 2, assists: 1, fantasyPoints: 11 },
      [entry(A, 'p3')]: { gamesPlayed: 0, points: 4, rebounds: 0, assists: 0, fantasyPoints: 4 },
      [entry(A, 'both')]: {
        gamesPlayed: 1,
        points: 0,
        rebounds: 1,
        assists: 0,
        fantasyPoints: 1.5,
      },
      [entry(B, 'both')]: { gamesPlayed: 1, points: 0, rebounds: 0, assists: 2, fantasyPoints: 4 },
      [entry(B, GHOST)]: { gamesPlayed: 1, points: 8, rebounds: 0, assists: 0, fantasyPoints: 8 },
    });
  });

  it('leaves out a row that sums to nothing — a present entry with no stats and no game played', () => {
    expect(contribution.membershipRows[entry(A, 'p2')]).toBeUndefined();
  });

  it("sums a person's two sides into one career line, two games played, and keeps the ghost out (SPORT-208)", () => {
    expect(contribution.personLines.both).toEqual({
      gamesPlayed: 2,
      points: 0,
      rebounds: 1,
      assists: 2,
      fantasyPoints: 5.5,
    });
    expect(contribution.personLines.p1).toEqual({
      gamesPlayed: 1,
      points: 6,
      rebounds: 2,
      assists: 1,
      fantasyPoints: 11,
    });
    expect(contribution.personLines[GHOST]).toBeUndefined();
  });

  it("makes a person's rows for the league add up, every stat, to what the league adds to their career", () => {
    const rows = [
      contribution.membershipRows[entry(A, 'both')],
      contribution.membershipRows[entry(B, 'both')],
    ];
    const summed = sumGameContributions(basketball.deriveLine, [
      {
        contribution: {
          teamLines: {},
          membershipRows: { x: rows[0]!, y: rows[1]! },
          personLines: {},
        },
        sign: 1,
      },
    ]);
    const total = Object.values(summed.membershipRows).reduce<Record<string, number>>(
      (sum, row) => {
        for (const [field, value] of Object.entries(row))
          sum[field] = (sum[field] ?? 0) + (value as number);
        return sum;
      },
      {},
    );
    expect(total).toEqual(contribution.personLines.both);
  });
});

describe('contribution — curling and football', () => {
  it.each([
    [
      'Curling',
      curling,
      { [A]: { score: 3, roundScores: [] }, [B]: { score: 3, roundScores: [] } },
    ],
    ['Football', football, { [A]: { score: 3 }, [B]: { score: 3 } }],
  ] as const)(
    'in %s, a tie for both teams and a game played for every present entry, none for an absent one',
    (leagueType, adapter, teamStats) => {
      const game: FinalizedGame = {
        leagueType,
        teamIds: [A, B],
        stats: { teamStats, playerStats: {} },
        rosterPlayerIds: [entry(A, 'x'), entry(A, 'y'), entry(B, 'z')],
        absentRosterPlayerIds: [entry(A, 'y')],
        nonScoringRosterPlayerIds: [],
      };
      const contribution = adapter.contribution(game);
      expect(contribution.teamLines[A]).toEqual({
        gamesPlayed: 1,
        wins: 0,
        losses: 0,
        ties: 1,
        pointsFor: 3,
        pointsAgainst: 3,
      });
      expect(contribution.membershipRows).toEqual({
        [entry(A, 'x')]: { gamesPlayed: 1 },
        [entry(B, 'z')]: { gamesPlayed: 1 },
      });
      expect(contribution.personLines).toEqual({ x: { gamesPlayed: 1 }, z: { gamesPlayed: 1 } });
    },
  );

  it('credits curling players even though curling records no player line', () => {
    const game: FinalizedGame = {
      leagueType: 'Curling',
      teamIds: [A, B],
      stats: curling.emptyStats({ teamIds: [A, B] }),
      rosterPlayerIds: [entry(A, 'x')],
      absentRosterPlayerIds: [],
      nonScoringRosterPlayerIds: [],
    };
    expect(curling.contribution(game).personLines.x).toEqual({ gamesPlayed: 1 });
  });

  it('adds nothing for a team with no opponent — a bye', () => {
    const game: FinalizedGame = {
      leagueType: 'Football',
      teamIds: [A],
      stats: football.emptyStats({ teamIds: [A] }),
      rosterPlayerIds: [entry(A, 'x')],
      absentRosterPlayerIds: [],
      nonScoringRosterPlayerIds: [],
    };
    expect(football.contribution(game)).toEqual({
      teamLines: {},
      membershipRows: {},
      personLines: {},
    });
  });
});

describe('applying a contribution to a stored line', () => {
  const row = { gamesPlayed: 1, points: 6, rebounds: 2, assists: 1, fantasyPoints: 11 };

  it('adds a game to no line, then takes it back to no line at all', () => {
    const added = applyStatLineDelta(basketball.deriveLine, 'membershipRow', undefined, row, 1);
    expect(added).toEqual({ ok: true, after: row });
    const removed = applyStatLineDelta(
      basketball.deriveLine,
      'membershipRow',
      added.ok ? (added.after ?? undefined) : undefined,
      row,
      -1,
    );
    expect(removed).toEqual({ ok: true, after: null });
  });

  it('re-derives FP from the moved counters, so a stale stored FP neither survives nor goes below zero', () => {
    // A stored FP of 2 against counters worth 23.5 (10 + 5 × 1.5 + 3 × 2) — a weight changed since. Moving it by −11 would
    // leave −9; the counters move instead and FP is derived from them: 4 + 3 × 1.5 + 2 × 2 = 12.5.
    const stale = { gamesPlayed: 3, points: 10, rebounds: 5, assists: 3, fantasyPoints: 2 };
    expect(applyStatLineDelta(basketball.deriveLine, 'lifetime', stale, row, -1)).toEqual({
      ok: true,
      after: { gamesPlayed: 2, points: 4, rebounds: 3, assists: 2, fantasyPoints: 12.5 },
    });
  });

  it('refuses, naming the field, a line that would go below zero', () => {
    const before = { gamesPlayed: 0, points: 6, rebounds: 2, assists: 1, fantasyPoints: 11 };
    expect(applyStatLineDelta(basketball.deriveLine, 'membershipRow', before, row, -1)).toEqual({
      ok: false,
      field: 'gamesPlayed',
    });
  });
});

describe('the finalized record', () => {
  const events = Array.from(
    { length: STAT_HISTORY_PAGE_SIZE * 2 + 1 },
    (_, index): GameStatEvent => ({
      eventId: `1712345678901_${String(index).padStart(5, '0')}`,
      sequence: index + 1,
      type: 'TIMEOUT',
      teamId: A,
      recordedAt: 1712345678901,
    }),
  );
  const snapshot = {
    leagueType: 'Basketball' as const,
    teamIds: [A, B],
    rosterPlayerIds: [entry(A, 'p1')],
    absentRosterPlayerIds: [],
    nonScoringRosterPlayerIds: [entry(A, 'p1')],
  };

  it('cuts a record past one page into pages, the first carrying the count and the snapshot', () => {
    const pages = buildFinalizedRecordPages(events, snapshot);
    expect(pages.map((page) => page.pageId)).toEqual(['page_0000', 'page_0001', 'page_0002']);
    expect(pages[0]?.page).toMatchObject({ pageCount: 3, ...snapshot });
    expect(pages.map((page) => page.page.events.length)).toEqual([
      STAT_HISTORY_PAGE_SIZE,
      STAT_HISTORY_PAGE_SIZE,
      1,
    ]);
  });

  it('reads back every event in order with its snapshot, and replays it to the game it describes', () => {
    const pages = buildFinalizedRecordPages(events, snapshot).map(({ page }) => page);
    expect(readFinalizedRecord(pages).events).toHaveLength(events.length);
    const game = finalizedGameFromRecord(basketball, pages);
    expect(game.stats.teamStats[A]).toEqual({ score: 0, timeouts: events.length });
    expect(game.nonScoringRosterPlayerIds).toEqual(snapshot.nonScoringRosterPlayerIds);
  });

  it('keeps a first page for a game with no events', () => {
    expect(buildFinalizedRecordPages([], snapshot)).toHaveLength(1);
  });

  it('refuses pages that are not one whole record', () => {
    const pages = buildFinalizedRecordPages(events, snapshot).map(({ page }) => page);
    expect(() => readFinalizedRecord(pages.slice(0, 2))).toThrow();
    expect(() => readFinalizedRecord(pages.slice(1))).toThrow();
  });
});

describe('a stored rollup against its replay', () => {
  const score = { [A]: 10, [B]: 8 };

  it('finds no difference when the game stores exactly its replay', () => {
    expect(
      rollupDifferences(
        basketball,
        { teamIds: [A, B], stats: basketballStats, score },
        basketballStats,
      ),
    ).toEqual([]);
  });

  it('finds a hand-edited player counter and a hand-edited score mirror', () => {
    const edited = structuredClone(basketballStats);
    edited.playerStats[entry(A, 'p1')]!.points = 9;
    const differences = rollupDifferences(
      basketball,
      { teamIds: [A, B], stats: edited, score: { ...score, [B]: 7 } },
      basketballStats,
    );
    expect(differences).toEqual([
      { kind: 'rollupMismatch', key: entry(A, 'p1'), field: 'points', stored: 9, replayed: 6 },
      { kind: 'scoreMirrorMismatch', key: B, field: 'score', stored: 7, replayed: 8 },
    ]);
  });

  it('does not count a stale stored FP as a difference — FP is derived, not recorded', () => {
    const stale = structuredClone(basketballStats);
    stale.playerStats[entry(A, 'p1')]!.fantasyPoints = 1;
    expect(
      rollupDifferences(basketball, { teamIds: [A, B], stats: stale, score }, basketballStats),
    ).toEqual([]);
  });
});

describe('the league rankings', () => {
  it('gives a player one season row per team they played for', () => {
    const rows = seasonRankingRows([
      { teamId: A, playerSeasonStats: { both: { gamesPlayed: 1 } } },
      { teamId: B, playerSeasonStats: { both: { gamesPlayed: 2 } } },
    ]);
    expect(rows).toEqual([
      { teamId: A, userId: 'both', line: { gamesPlayed: 1 } },
      { teamId: B, userId: 'both', line: { gamesPlayed: 2 } },
    ]);
  });

  it('offers only the weeks holding a completed game, in the order they start', () => {
    const game = (weekId: string, weekStartDate: number, status: 'completed' | 'scheduled') => ({
      weekId,
      weekTitle: weekId,
      weekStartDate,
      status,
    });
    expect(
      playedWeeks([
        game('w2', 20, 'completed'),
        game('w3', 30, 'scheduled'),
        game('w1', 10, 'completed'),
      ]).map((week) => week.weekId),
    ).toEqual(['w1', 'w2']);
  });

  it("sums a week's completed games into rows, one per team a player played for", () => {
    const first = basketballGame();
    const week = weekRankingRows(basketball, [first, first]);
    const p1 = week.find((row) => row.teamId === A && row.userId === 'p1');
    expect(p1?.line).toEqual({
      gamesPlayed: 2,
      points: 12,
      rebounds: 4,
      assists: 2,
      fantasyPoints: 22,
    });
    expect(
      week
        .filter((row) => row.userId === 'both')
        .map((row) => row.teamId)
        .sort(),
    ).toEqual([A, B]);
  });

  it("gives rows that, over every week, add up to the season's stored rows", () => {
    // Week 1 is the fixture game; week 2 a game where p1 sits out and p2 scores a basket.
    const weekOne = [basketballGame()];
    const secondStats: BasketballGameStats = {
      teamStats: { [A]: { score: 2, timeouts: 0 }, [B]: { score: 8, timeouts: 0 } },
      playerStats: {
        [entry(A, 'p2')]: { points: 2, rebounds: 0, assists: 0, fantasyPoints: 2 },
        [entry(B, GHOST)]: { points: 8, rebounds: 1, assists: 0, fantasyPoints: 9.5 },
      },
    };
    const secondAbsent = [entry(A, 'p1')];
    const weekTwo: FinalizedGame[] = [
      {
        ...basketballGame(),
        stats: secondStats,
        absentRosterPlayerIds: secondAbsent,
        nonScoringRosterPlayerIds: basketball.participation(
          secondStats,
          basketballRoster,
          secondAbsent,
        ),
      },
    ];

    // The season as finalize stores it: each game's rows applied, one at a time, to the teams' rows.
    const stored: Record<string, Record<string, Record<string, number>>> = { [A]: {}, [B]: {} };
    for (const game of [...weekOne, ...weekTwo]) {
      for (const [entryId, row] of Object.entries(basketball.contribution(game).membershipRows)) {
        const { teamId, userId } = parseGameRosterPlayerId(entryId) as {
          teamId: string;
          userId: string;
        };
        const moved = applyStatLineDelta(
          basketball.deriveLine,
          'membershipRow',
          stored[teamId]?.[userId],
          row,
          1,
        );
        if (!moved.ok) throw new Error(`below zero at ${moved.field}`);
        if (moved.after === null) delete stored[teamId]?.[userId];
        else
          (stored[teamId] as Record<string, Record<string, number>>)[userId] =
            moved.after as Record<string, number>;
      }
    }
    const season = seasonRankingRows(
      Object.entries(stored).map(([teamId, playerSeasonStats]) => ({ teamId, playerSeasonStats })),
    );

    const added = new Map<string, Record<string, number>>();
    for (const row of [
      ...weekRankingRows(basketball, weekOne),
      ...weekRankingRows(basketball, weekTwo),
    ]) {
      const key = `${row.teamId}/${row.userId}`;
      const sum = added.get(key) ?? {};
      for (const [field, value] of Object.entries(row.line))
        sum[field] = (sum[field] ?? 0) + (value as number);
      added.set(key, sum);
    }
    expect(Object.fromEntries(added)).toEqual(
      Object.fromEntries(season.map((row) => [`${row.teamId}/${row.userId}`, row.line])),
    );
    // p1 played week 1 only; p2 has a game played only from week 2.
    expect(added.get(`${A}/p1`)).toMatchObject({ gamesPlayed: 1, points: 6 });
    expect(added.get(`${A}/p2`)).toMatchObject({ gamesPlayed: 1, points: 2 });
  });
});

describe('the higher of two team roles', () => {
  it('keeps the captain over a co-captain or a player, and a co-captain over a player', () => {
    expect(higherTeamRole('player', 'captain')).toBe('captain');
    expect(higherTeamRole('coCaptain', 'player')).toBe('coCaptain');
    expect(higherTeamRole('coCaptain', 'captain')).toBe('captain');
  });
});

describe('contribution — a scoreless team in the team-scored sports', () => {
  // A scores and B does not: a curling end worth the most an end is worth, or a football touchdown.
  const [TOUCHDOWN] = FOOTBALL_SCORE_EVENT_TYPE_KEYS;
  const curlingShutout = curling.apply(curling.emptyStats({ teamIds: [A, B] }), {
    type: CURLING_ROUND_SCORE_EVENT_TYPE,
    teamId: A,
    roundNumber: 1,
    points: MAX_CURLING_ROUND_POINTS,
  });
  const footballShutout = football.apply(football.emptyStats({ teamIds: [A, B] }), {
    type: TOUCHDOWN,
    teamId: A,
  });

  it.each([
    ['Curling', curling, curlingShutout],
    ['Football', football, footballShutout],
  ] as const)(
    'in %s, credits the present player of a team that scored nothing a game played, and the absent one none',
    (leagueType, adapter, stats) => {
      // On B, `present` played and `away` was marked absent; neither holds a player line.
      const roster = [entry(A, 'x'), entry(B, 'away'), entry(B, 'present')];
      const absent = [entry(B, 'away')];
      const game: FinalizedGame = {
        leagueType,
        teamIds: [A, B],
        stats,
        rosterPlayerIds: roster,
        absentRosterPlayerIds: absent,
        nonScoringRosterPlayerIds: adapter.participation(stats, roster, absent),
      };
      const contribution = adapter.contribution(game);

      expect(gameScoreMirror(stats)[A]).toBeGreaterThan(0);
      expect(stats.playerStats).toEqual({});
      expect(game.nonScoringRosterPlayerIds).toEqual([]);
      expect(contribution.teamLines[B]).toEqual({
        gamesPlayed: 1,
        wins: 0,
        losses: 1,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: gameScoreMirror(stats)[A],
      });
      expect(contribution.membershipRows).toEqual({
        [entry(A, 'x')]: { gamesPlayed: 1 },
        [entry(B, 'present')]: { gamesPlayed: 1 },
      });
      expect(contribution.personLines).toEqual({
        x: { gamesPlayed: 1 },
        present: { gamesPlayed: 1 },
      });
    },
  );
});
