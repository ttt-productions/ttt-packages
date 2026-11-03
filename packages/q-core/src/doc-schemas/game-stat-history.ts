import { z } from 'zod';
import { MAX_STAT_EVENTS_PER_GAME, MAX_TEAMS_PER_GAME } from '../constants/business.js';
import { gameRosterPlayerIdSchema, leagueTypeSchema, teamIdSchema } from './atoms.js';
import { GameStatEventSchema } from './game-stats.js';

export const GameStatHistoryRecordSchema = z.object({
  events: z
    .array(GameStatEventSchema)
    .max(MAX_STAT_EVENTS_PER_GAME)
    .refine(
      (events) =>
        events.every((event, index) => index === 0 || events[index - 1].sequence < event.sequence),
      'A finalized record holds its events in sequence order.',
    ),
  leagueType: leagueTypeSchema,
  teamIds: z.array(teamIdSchema).min(1).max(MAX_TEAMS_PER_GAME),
  rosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  absentRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  nonScoringRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
});
export type GameStatHistoryRecord = z.infer<typeof GameStatHistoryRecordSchema>;
