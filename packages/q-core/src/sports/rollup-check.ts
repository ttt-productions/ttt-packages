import type { GameStats } from '../doc-schemas/sport-game.js';
import { gameScoreMirror } from './score-mirror.js';
import { isAllZeroLine } from './scoring.js';
import type { StatLineValues } from './scoring.js';
import type { AnySportAdapter } from './sport-adapter.js';

export interface RollupDifference {
  readonly kind: 'rollupMismatch' | 'scoreMirrorMismatch';
  readonly key: string;
  readonly field: string;
  readonly stored: unknown;
  readonly replayed: unknown;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length && left.every((slot, index) => Object.is(slot, right[index]))
    );
  }
  return Object.is(left, right);
}

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
