// The replay: a game's rollup rebuilt from its event documents, in `sequence` order, from the
// sport's empty stats (SPORT-101). It is the one fold every path that derives a game's numbers runs —
// the Functions, the client's queue, and the browser's week view — and the store driver folds each
// new event it accepts through the same step, `foldStatEvent`, so the replay and the write can never
// disagree about what an event does.

import type { GameStatEvent } from '../doc-schemas/game-stats.js';
import type { GameStats } from '../doc-schemas/sport-game.js';
import { isSportStatEventIn, isStatVoid, type StatEventBody } from './scoring.js';
import type { AnySportAdapter, GameTeamIds } from './sport-adapter.js';

/** A stored event the replay could not fold — damage in the event store, never a designed answer. */
export class StatReplayError extends Error {
  readonly eventId: string;

  constructor(eventId: string, cause: unknown) {
    super(`Stat event ${eventId} cannot be replayed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = 'StatReplayError';
    this.eventId = eventId;
  }
}

/**
 * `state` with a team line for each of the game's teams, the missing ones from the sport's empty
 * stats — so a team's first stat is never refused as a team not in the game. No other line is touched.
 */
export function withGameTeamLines(adapter: AnySportAdapter, state: GameStats, game: GameTeamIds): GameStats {
  if (game.teamIds.every((teamId) => state.teamStats[teamId] !== undefined)) return state;
  const empty = adapter.emptyStats(game);
  return { teamStats: { ...empty.teamStats, ...state.teamStats }, playerStats: state.playerStats } as GameStats;
}

/**
 * `state` with one event folded in: a sport event or a correction applied, or a void's target
 * undone. `targetOf` answers from the events already folded; a void whose target is missing, a void,
 * or a correction throws.
 */
export function foldStatEvent(
  adapter: AnySportAdapter,
  state: GameStats,
  event: StatEventBody,
  targetOf: (eventId: string) => StatEventBody | undefined,
): GameStats {
  if (isStatVoid(event)) {
    const target = targetOf(event.targetEventId);
    if (!isSportStatEventIn(adapter.eventTypes, target)) {
      throw new Error(`the void's target ${event.targetEventId} is not a ${adapter.leagueType} event folded before it`);
    }
    return adapter.undo(state, target);
  }
  return adapter.apply(state, event);
}

/** The rollup a game's events replay to: every line, derived fields included, and each team's score. */
export function replayGameStats(adapter: AnySportAdapter, game: GameTeamIds, events: readonly GameStatEvent[]): GameStats {
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
