import type { GameStatEvent } from '../doc-schemas/game-stats.js';
import type { GameStats } from '../doc-schemas/sport-game.js';
import { isSportStatEventIn, isStatVoid, type StatEventBody } from './scoring.js';
import type { AnySportAdapter, GameTeamIds } from './sport-adapter.js';

export class StatReplayError extends Error {
  readonly eventId: string;

  constructor(eventId: string, cause: unknown) {
    super(
      `Stat event ${eventId} cannot be replayed: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = 'StatReplayError';
    this.eventId = eventId;
  }
}

export function withGameTeamLines(
  adapter: AnySportAdapter,
  state: GameStats,
  game: GameTeamIds,
): GameStats {
  if (game.teamIds.every((teamId) => state.teamStats[teamId] !== undefined)) return state;
  const empty = adapter.emptyStats(game);
  return {
    teamStats: { ...empty.teamStats, ...state.teamStats },
    playerStats: state.playerStats,
  } as GameStats;
}

export function foldStatEvent(
  adapter: AnySportAdapter,
  state: GameStats,
  event: StatEventBody,
  targetOf: (eventId: string) => StatEventBody | undefined,
): GameStats {
  if (isStatVoid(event)) {
    const target = targetOf(event.targetEventId);
    if (!isSportStatEventIn(adapter.eventTypes, target)) {
      throw new Error(
        `the void's target ${event.targetEventId} is not a ${adapter.leagueType} event folded before it`,
      );
    }
    return adapter.undo(state, target);
  }
  return adapter.apply(state, event);
}

export function replayGameStats(
  adapter: AnySportAdapter,
  game: GameTeamIds,
  events: readonly GameStatEvent[],
): GameStats {
  const folded = new Map<string, GameStatEvent>();
  let state: GameStats = adapter.emptyStats(game);
  for (const event of [...events].sort((left, right) => left.sequence - right.sequence)) {
    try {
      state = foldStatEvent(adapter, state, event, (eventId) => folded.get(eventId));
    } catch (error) {
      throw new StatReplayError(event.eventId, error);
    }
    folded.set(event.eventId, event);
  }
  return state;
}
