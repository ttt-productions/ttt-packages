import type { GameStats } from '../doc-schemas/sport-game.js';
import { parseGameRosterPlayerId } from '../ids/compound-ids.js';
import { isGhostUserId } from '../ids/minted-ids.js';
import type { LeagueType } from '../types/sports.js';
import type { StatLineKind } from '../types/stats.js';
import { isAllZeroLine } from './scoring.js';
import type { StatLineValues } from './scoring.js';

export interface FinalizedGame {
  readonly leagueType: LeagueType;
  readonly teamIds: readonly string[];
  readonly stats: GameStats;
  readonly rosterPlayerIds: readonly string[];
  readonly absentRosterPlayerIds: readonly string[];
  readonly nonScoringRosterPlayerIds: readonly string[];
}

export interface GameContribution {
  readonly teamLines: Readonly<Record<string, StatLineValues>>;
  readonly membershipRows: Readonly<Record<string, StatLineValues>>;
  readonly personLines: Readonly<Record<string, StatLineValues>>;
}

export const EMPTY_GAME_CONTRIBUTION: GameContribution = {
  teamLines: {},
  membershipRows: {},
  personLines: {},
};

export interface ContributionSpec {
  readonly playerStatKeys: readonly string[];
  readonly teamSeasonPlayerSums: readonly string[];
  readonly zeroLineIsNonScoring: boolean;
  readonly deriveLine: (kind: StatLineKind, line: StatLineValues) => StatLineValues;
}

function counter(line: StatLineValues | undefined, field: string): number {
  const value = line?.[field];
  return typeof value === 'number' ? value : 0;
}

export function isZeroStatLine(line: StatLineValues): boolean {
  return Object.values(line).every((value) => typeof value !== 'number' || value === 0);
}

export function decideParticipation(
  spec: Pick<ContributionSpec, 'playerStatKeys' | 'zeroLineIsNonScoring'>,
  stats: GameStats,
  rosterPlayerIds: readonly string[],
  absentRosterPlayerIds: readonly string[],
): string[] {
  if (!spec.zeroLineIsNonScoring) return [];
  const absent = new Set(absentRosterPlayerIds);
  const playerStats = stats.playerStats as Readonly<Record<string, StatLineValues>>;
  return rosterPlayerIds.filter((entryId) => {
    if (absent.has(entryId)) return true;
    const line = playerStats[entryId];
    return line === undefined || isAllZeroLine(line, spec.playerStatKeys);
  });
}

export function isCreditedGamePlayed(
  game: Pick<FinalizedGame, 'absentRosterPlayerIds' | 'nonScoringRosterPlayerIds'>,
  entryId: string,
): boolean {
  return (
    !game.absentRosterPlayerIds.includes(entryId) &&
    !game.nonScoringRosterPlayerIds.includes(entryId)
  );
}

export function addStatLines(
  left: StatLineValues,
  right: StatLineValues,
  sign: 1 | -1 = 1,
): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const field of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const [a, b] = [left[field], right[field]];
    if ((a !== undefined && typeof a !== 'number') || (b !== undefined && typeof b !== 'number'))
      continue;
    sum[field] = (a ?? 0) + sign * (b ?? 0);
  }
  return sum;
}

export function buildGameContribution(
  spec: ContributionSpec,
  game: FinalizedGame,
): GameContribution {
  const teamStats = game.stats.teamStats as Readonly<Record<string, StatLineValues>>;
  const playerStats = game.stats.playerStats as Readonly<Record<string, StatLineValues>>;
  const opponentOf = (teamId: string): string | undefined =>
    game.teamIds.find((other) => other !== teamId);
  const counted = new Set(game.teamIds.filter((teamId) => opponentOf(teamId) !== undefined));

  const teamLines: Record<string, StatLineValues> = {};
  for (const teamId of counted) {
    const scored = counter(teamStats[teamId], 'score');
    const allowed = counter(teamStats[opponentOf(teamId) as string], 'score');
    const line: Record<string, number> = {
      gamesPlayed: 1,
      wins: scored > allowed ? 1 : 0,
      losses: scored < allowed ? 1 : 0,
      ties: scored === allowed ? 1 : 0,
      pointsFor: scored,
      pointsAgainst: allowed,
    };
    for (const field of spec.teamSeasonPlayerSums) line[field] = 0;
    for (const [entryId, playerLine] of Object.entries(playerStats)) {
      if (parseGameRosterPlayerId(entryId)?.teamId !== teamId) continue;
      for (const field of spec.teamSeasonPlayerSums)
        line[field] = (line[field] ?? 0) + counter(playerLine, field);
    }
    teamLines[teamId] = spec.deriveLine('teamSeason', line);
  }

  const membershipRows: Record<string, StatLineValues> = {};
  const personTotals = new Map<string, Record<string, number>>();
  const entryIds = [...new Set([...game.rosterPlayerIds, ...Object.keys(playerStats)])].sort();
  for (const entryId of entryIds) {
    const entry = parseGameRosterPlayerId(entryId);
    if (entry === null || !counted.has(entry.teamId)) continue;
    const row: Record<string, number> = {
      gamesPlayed: isCreditedGamePlayed(game, entryId) ? 1 : 0,
    };
    for (const field of spec.playerStatKeys) row[field] = counter(playerStats[entryId], field);
    if (isZeroStatLine(row)) continue;
    membershipRows[entryId] = spec.deriveLine('membershipRow', row);
    if (isGhostUserId(entry.userId)) continue;
    personTotals.set(entry.userId, addStatLines(personTotals.get(entry.userId) ?? {}, row));
  }

  const personLines: Record<string, StatLineValues> = {};
  for (const [userId, line] of personTotals)
    personLines[userId] = spec.deriveLine('lifetime', line);
  return { teamLines, membershipRows, personLines };
}

export interface SignedContribution {
  readonly contribution: GameContribution;
  readonly sign: 1 | -1;
}

export function sumGameContributions(
  deriveLine: ContributionSpec['deriveLine'],
  signed: readonly SignedContribution[],
): GameContribution {
  const fold = (
    pick: (contribution: GameContribution) => Readonly<Record<string, StatLineValues>>,
    kind: StatLineKind,
  ) => {
    const totals = new Map<string, Record<string, number>>();
    for (const { contribution, sign } of signed) {
      for (const [key, line] of Object.entries(pick(contribution))) {
        totals.set(key, addStatLines(totals.get(key) ?? {}, line, sign));
      }
    }
    const lines: Record<string, StatLineValues> = {};
    for (const [key, line] of totals) {
      const derived = deriveLine(kind, line);
      if (!isZeroStatLine(derived)) lines[key] = derived;
    }
    return lines;
  };
  return {
    teamLines: fold((contribution) => contribution.teamLines, 'teamSeason'),
    membershipRows: fold((contribution) => contribution.membershipRows, 'membershipRow'),
    personLines: fold((contribution) => contribution.personLines, 'lifetime'),
  };
}

export type StatLineChange =
  | { readonly ok: true; readonly after: StatLineValues | null }
  | { readonly ok: false; readonly field: string };

/**
 * A counter that would go below zero is refused, never clamped: it means the stored line no longer
 * holds what the games put there.
 */
export function applyStatLineDelta(
  deriveLine: ContributionSpec['deriveLine'],
  kind: StatLineKind,
  before: StatLineValues | undefined,
  delta: StatLineValues,
  sign: 1 | -1,
): StatLineChange {
  // A derived field is recomputed from the moved counters, never moved itself, so a stale stored FP
  // can neither go below zero nor survive.
  const after = deriveLine(kind, addStatLines(before ?? {}, delta, sign));
  const below = Object.entries(after).find(([, value]) => typeof value === 'number' && value < 0);
  if (below) return { ok: false, field: below[0] };
  return { ok: true, after: isZeroStatLine(after) ? null : after };
}
