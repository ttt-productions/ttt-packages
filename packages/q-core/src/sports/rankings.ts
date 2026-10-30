import { COMPLETED_GAME_STATUS } from '../types/unions.js';
import type { GameStatus } from '../types/unions.js';
import { parseGameRosterPlayerId } from '../ids/compound-ids.js';
import { sumGameContributions } from './contribution.js';
import type { FinalizedGame } from './contribution.js';
import type { StatLineValues } from './scoring.js';
import type { AnySportAdapter } from './sport-adapter.js';

export interface RankingRow {
  readonly teamId: string;
  readonly userId: string;
  readonly line: StatLineValues;
}

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

export interface PlayedWeek {
  readonly weekId: string;
  readonly weekTitle: string;
  readonly weekStartDate: number;
}

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
