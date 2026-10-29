// Whether a game's stored numbers are what produced them: the rollup's counters and the score mirror
// against a replay — of the event documents for a live game, of the finalized record for a completed
// one. Finalize, reopen, a ghost link, and validation ask this one comparison, so a hand edit to the
// game document is found the same way everywhere and never adopted or discarded silently (RULE-STD-ENG-009).
//
// Counters are compared, never a derived field: a stored FP a weight change left stale is not a
// difference in what was recorded, and the writer re-derives it.

import type { GameStats } from '../doc-schemas/sport-game.js';
import { gameScoreMirror } from './score-mirror.js';
import { isAllZeroLine } from './scoring.js';
import type { StatLineValues } from './scoring.js';
import type { AnySportAdapter } from './sport-adapter.js';

/** One place a stored rollup or score mirror differs from the replay. */
export interface RollupDifference {
  readonly kind: 'rollupMismatch' | 'scoreMirrorMismatch';
  /** The team id of a team line or score, or the roster-entry id of a player line. */
  readonly key: string;
  readonly field: string;
  readonly stored: unknown;
  readonly replayed: unknown;
}

/** Two stored line values alike: a number, or a list of round slots, slot by slot. */
function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((slot, index) => Object.is(slot, right[index]))
    );
  }
  return Object.is(left, right);
}

/** The fields a line is compared on: every field of a team line, the counters of a player line. */
function compared(
  line: StatLineValues | undefined,
  fields: readonly string[] | null,
): Record<string, unknown> {
  if (line === undefined) return {};
  const keys = fields ?? Object.keys(line);
  return Object.fromEntries(
    keys.filter((field) => line[field] !== undefined).map((field) => [field, line[field]]),
  );
}

/**
 * Every difference between the stored rollup and score mirror and the replay. A player line that
 * holds nothing and one that is absent are alike; a team line is compared whole, its round slots
 * included, for each of the game's teams.
 */
export function rollupDifferences(
  adapter: AnySportAdapter,
  game: {
    readonly teamIds: readonly string[];
    readonly stats: GameStats;
    readonly score: Readonly<Record<string, number>>;
  },
  replayed: GameStats,
): RollupDifference[] {
  const differences: RollupDifference[] = [];
  const storedTeams = game.stats.teamStats as Readonly<Record<string, StatLineValues>>;
  const replayedTeams = replayed.teamStats as Readonly<Record<string, StatLineValues>>;
  const teamKeys = new Set([...game.teamIds, ...Object.keys(storedTeams)]);
  for (const teamId of teamKeys) {
    const stored = compared(storedTeams[teamId], null);
    const replay = compared(replayedTeams[teamId], null);
    for (const field of new Set([...Object.keys(stored), ...Object.keys(replay)])) {
      if (!sameValue(stored[field], replay[field])) {
        differences.push({
          kind: 'rollupMismatch',
          key: teamId,
          field,
          stored: stored[field],
          replayed: replay[field],
        });
      }
    }
  }

  const counters = adapter.playerStatKeys as readonly string[];
  const storedPlayers = game.stats.playerStats as Readonly<Record<string, StatLineValues>>;
  const replayedPlayers = replayed.playerStats as Readonly<Record<string, StatLineValues>>;
  const holding = (lines: Readonly<Record<string, StatLineValues>>) =>
    Object.keys(lines).filter(
      (entryId) => !isAllZeroLine(lines[entryId] as StatLineValues, counters),
    );
  for (const entryId of new Set([...holding(storedPlayers), ...holding(replayedPlayers)])) {
    const stored = compared(storedPlayers[entryId], counters);
    const replay = compared(replayedPlayers[entryId], counters);
    for (const field of counters) {
      const [left, right] = [stored[field] ?? 0, replay[field] ?? 0];
      if (left !== right)
        differences.push({
          kind: 'rollupMismatch',
          key: entryId,
          field,
          stored: left,
          replayed: right,
        });
    }
  }

  const mirror = gameScoreMirror(replayed as { teamStats: Record<string, { score: number }> });
  for (const teamId of new Set([...Object.keys(game.score), ...Object.keys(mirror)])) {
    if (game.score[teamId] !== mirror[teamId]) {
      differences.push({
        kind: 'scoreMirrorMismatch',
        key: teamId,
        field: 'score',
        stored: game.score[teamId],
        replayed: mirror[teamId],
      });
    }
  }
  return differences;
}
