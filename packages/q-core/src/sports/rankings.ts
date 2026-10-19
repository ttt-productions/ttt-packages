// The league's player rankings: one row per team a player played for, for the whole season or for
// one saved week. The season rows are the teams' stored
// per-membership rows; a week's rows are derived at read, never stored — the contributions of that
// week's completed games summed through the same mapping finalize applies, so a week's rows over
// every week add up to the season's.

import { COMPLETED_GAME_STATUS } from '../types/unions.js';
import type { GameStatus } from '../types/unions.js';
import { parseGameRosterPlayerId } from '../ids/compound-ids.js';
import { sumGameContributions } from './contribution.js';
import type { FinalizedGame } from './contribution.js';
import type { StatLineValues } from './scoring.js';
import type { AnySportAdapter } from './sport-adapter.js';

/** One rankings row: a person's games for one team, keyed by the membership the team, league, and person name. */
export interface RankingRow {
  readonly teamId: string;
  readonly userId: string;
  readonly line: StatLineValues;
}

/** The season rows: every team's stored per-membership rows, one per team a player played for. */
export function seasonRankingRows(
  teams: readonly {
    readonly teamId: string;
    readonly playerSeasonStats?: Readonly<Record<string, StatLineValues>>;
  }[],
): RankingRow[] {
  return teams.flatMap(({ teamId, playerSeasonStats }) =>
    Object.entries(playerSeasonStats ?? {}).map(([userId, line]) => ({ teamId, userId, line })),
  );
}

/** A saved schedule week as the rankings' week filter offers it. */
export interface PlayedWeek {
  readonly weekId: string;
  readonly weekTitle: string;
  readonly weekStartDate: number;
}

/**
 * The weeks the filter offers: every saved week holding at least one completed game, in the order
 * the weeks start, taken from the game documents the league schedule already loads.
 */
export function playedWeeks(
  games: readonly {
    readonly weekId: string;
    readonly weekTitle: string;
    readonly weekStartDate: number;
    readonly status: GameStatus;
  }[],
): PlayedWeek[] {
  const weeks = new Map<string, PlayedWeek>();
  for (const game of games) {
    if (game.status !== COMPLETED_GAME_STATUS || weeks.has(game.weekId)) continue;
    weeks.set(game.weekId, {
      weekId: game.weekId,
      weekTitle: game.weekTitle,
      weekStartDate: game.weekStartDate,
    });
  }
  return [...weeks.values()].sort(
    (left, right) =>
      left.weekStartDate - right.weekStartDate || left.weekId.localeCompare(right.weekId),
  );
}

/**
 * One week's rows: the summed contributions of the week's completed games, each read from its
 * finalized record (`finalizedGameFromRecord`). A player who played both sides of a game that week
 * has a row on each team.
 */
export function weekRankingRows(
  adapter: AnySportAdapter,
  games: readonly FinalizedGame[],
): RankingRow[] {
  const summed = sumGameContributions(
    adapter.deriveLine,
    games.map((game) => ({ contribution: adapter.contribution(game), sign: 1 as const })),
  );
  return Object.entries(summed.membershipRows).flatMap(([entryId, line]) => {
    const entry = parseGameRosterPlayerId(entryId);
    return entry === null ? [] : [{ teamId: entry.teamId, userId: entry.userId, line }];
  });
}
