// The aggregate half of the sport adapter contract: who a completed game credits a game played, and
// what the game adds to every derived destination (SPORT-201, SPORT-204, SPORT-207). Each sport
// declares its mapping once, as a `ContributionSpec`; the two members built from it — `participation`
// and `contribution` — are the only place a game's effect on standings, per-membership rows, lifetime
// lines, and the hall of fame is decided. Finalize, reopen, a ghost link, every rebuild, validation,
// and the week view all derive through them, so no two paths can disagree about what a game adds.
//
// Everything here is pure: no Firestore operation, no clock, no id minted (ARCH-202). The aggregate
// writer in Functions applies a contribution; the browser sums contributions for the week view.
//
// A stored derived line that sums to nothing — every counter and games played zero — is the same as
// no line at all, as an all-zero player line is in a game's rollup: a contribution leaves one out,
// and applying a contribution removes a line it returns to zero. That is what makes finalize followed
// by reopen leave every destination exactly as it was.

import type { GameStats } from '../doc-schemas/sport-game.js';
import { parseGameRosterPlayerId } from '../ids/compound-ids.js';
import { isGhostUserId } from '../ids/minted-ids.js';
import type { LeagueType } from '../types/sports.js';
import type { StatLineKind } from '../types/stats.js';
import { isAllZeroLine } from './scoring.js';
import type { StatLineValues } from './scoring.js';

/**
 * A completed game as its finalized record holds it: the record's events replayed to lines, and the
 * first page's sport, teams, and participation snapshot. Finalize builds it from the game it is
 * finalizing; every later path builds it from the record, never from the game document (SPORT-204).
 */
export interface FinalizedGame {
  readonly leagueType: LeagueType;
  readonly teamIds: readonly string[];
  readonly stats: GameStats;
  readonly rosterPlayerIds: readonly string[];
  readonly absentRosterPlayerIds: readonly string[];
  readonly nonScoringRosterPlayerIds: readonly string[];
}

/**
 * What one completed game adds to each destination, before the caller's sign. Every line carries its
 * derived fields through the sport's `deriveLine`.
 */
export interface GameContribution {
  /** Per team id: the team's standings line (`teamSeason`). A team with no opponent has none. */
  readonly teamLines: Readonly<Record<string, StatLineValues>>;
  /** Per roster-entry id: that membership's row (`membershipRow`), credited to the team in its key. */
  readonly membershipRows: Readonly<Record<string, StatLineValues>>;
  /**
   * Per person who is not a ghost: the sum of that person's rows, games played included — what the
   * game adds to `lifetimeStats.{sportKey}` and, where the sport keeps one, the hall of fame
   * (`lifetime`). A person on both teams of the game counts both sides (SPORT-208 keeps ghosts out).
   */
  readonly personLines: Readonly<Record<string, StatLineValues>>;
}

export const EMPTY_GAME_CONTRIBUTION: GameContribution = {
  teamLines: {},
  membershipRows: {},
  personLines: {},
};

/** One sport's aggregate mapping, declared once by its adapter (SPORT-207). */
export interface ContributionSpec {
  /** The counters of a player line that a membership row, a lifetime line, and the hall of fame sum. */
  readonly playerStatKeys: readonly string[];
  /** The player counters summed onto the team's standings line from the lines keyed to that team. */
  readonly teamSeasonPlayerSums: readonly string[];
  /**
   * Whether a present entry whose line holds nothing is credited no game played. Basketball's rule:
   * zero points, rebounds, and assists — zero points alone is not exclusion. Without it only absence
   * withholds a game played.
   */
  readonly zeroLineIsNonScoring: boolean;
  readonly deriveLine: (kind: StatLineKind, line: StatLineValues) => StatLineValues;
}

/** The value of a counter on a stored line, absent read as zero. */
function counter(line: StatLineValues | undefined, field: string): number {
  const value = line?.[field];
  return typeof value === 'number' ? value : 0;
}

/** Whether every number a line holds is zero: a derived line that sums to nothing. */
export function isZeroStatLine(line: StatLineValues): boolean {
  return Object.values(line).every((value) => typeof value !== 'number' || value === 0);
}

/**
 * The games-played decision for every roster entry: the entries credited no game played. An absent
 * entry is never credited; under `zeroLineIsNonScoring` a present entry whose line holds nothing is
 * not either. Stored on the completed game as `nonScoringRosterPlayerIds` and read, never decided
 * again, by every later path (SPORT-204). Returned in roster order.
 */
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

/** Whether the stored decision credits the entry a game played. */
export function isCreditedGamePlayed(
  game: Pick<FinalizedGame, 'absentRosterPlayerIds' | 'nonScoringRosterPlayerIds'>,
  entryId: string,
): boolean {
  return (
    !game.absentRosterPlayerIds.includes(entryId) &&
    !game.nonScoringRosterPlayerIds.includes(entryId)
  );
}

/** `left` with every number of `right` added `sign` times; a field only one holds is kept. */
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

/**
 * The contribution of one completed game under a sport's mapping. Every line derives from the
 * replayed lines and the stored decision only, never from a stored total (SPORT-202, SPORT-204):
 *
 * - each team with an opponent: one game, a win, loss, or tie decided from the two replayed scores,
 *   its points for and against, and the spec's player counters summed from the lines keyed to it;
 * - each roster entry of such a team — and any line keyed to one, rostered or not, so no recorded
 *   stat is lost — its row: games played per the stored decision, and the sport's counters, credited
 *   to the team in its key;
 * - each person who is not a ghost: the sum of their rows.
 *
 * A row or person line that sums to nothing is left out.
 */
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

/** A contribution and the sign it is applied with: +1 to add a game, −1 to take it back. */
export interface SignedContribution {
  readonly contribution: GameContribution;
  readonly sign: 1 | -1;
}

/**
 * Several signed contributions folded into one, every line through the sport's `deriveLine` and a
 * line that sums to nothing left out — the week view's rows, a rebuild's totals, and a ghost link's
 * reversal of the old entries beside the merged one, all through the same arithmetic.
 */
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

/**
 * A stored line moved by a delta: the line after, `null` when it sums to nothing, or the field that
 * would go below zero.
 */
export type StatLineChange =
  | { readonly ok: true; readonly after: StatLineValues | null }
  | { readonly ok: false; readonly field: string };

/**
 * `before` (absent read as no line) moved by `delta` times `sign`, through the sport's `deriveLine`
 * for `kind`. A counter that would go below zero is refused, never clamped: it means the stored line
 * no longer holds what the games put there.
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
