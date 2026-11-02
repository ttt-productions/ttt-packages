import { MAX_STAT_EVENTS_PER_GAME } from '../constants/business.js';
import type { GameStatEvent } from '../doc-schemas/game-stats.js';
import type { GameStatHistoryRecord } from '../doc-schemas/game-stat-history.js';
import type { FinalizedGame } from './contribution.js';
import { replayGameStats } from './replay.js';
import type { AnySportAdapter } from './sport-adapter.js';

export type FinalizedRecordSnapshot = Omit<GameStatHistoryRecord, 'events'>;

export function buildFinalizedRecord(
  events: readonly GameStatEvent[],
  snapshot: Pick<
    FinalizedGame,
    | 'leagueType'
    | 'teamIds'
    | 'rosterPlayerIds'
    | 'absentRosterPlayerIds'
    | 'nonScoringRosterPlayerIds'
  >,
): GameStatHistoryRecord {
  if (events.length > MAX_STAT_EVENTS_PER_GAME) {
    throw new RangeError(
      `A finalized record holds at most ${MAX_STAT_EVENTS_PER_GAME} events, not ${events.length}.`,
    );
  }
  return {
    events: [...events].sort((left, right) => left.sequence - right.sequence),
    leagueType: snapshot.leagueType,
    teamIds: [...snapshot.teamIds],
    rosterPlayerIds: [...snapshot.rosterPlayerIds],
    absentRosterPlayerIds: [...snapshot.absentRosterPlayerIds],
    nonScoringRosterPlayerIds: [...snapshot.nonScoringRosterPlayerIds],
  };
}

export function finalizedGameFromRecord(
  adapter: AnySportAdapter,
  record: GameStatHistoryRecord,
): FinalizedGame {
  const { events, ...snapshot } = record;
  return {
    leagueType: snapshot.leagueType,
    teamIds: snapshot.teamIds,
    stats: replayGameStats(adapter, snapshot, events),
    rosterPlayerIds: snapshot.rosterPlayerIds,
    absentRosterPlayerIds: snapshot.absentRosterPlayerIds,
    nonScoringRosterPlayerIds: snapshot.nonScoringRosterPlayerIds,
  };
}
