import { z } from 'zod';
import { STAT_HISTORY_PAGE_SIZE } from '../constants/sports.js';
import { gameRosterPlayerIdSchema, leagueTypeSchema, teamIdSchema } from './atoms.js';
import { GameStatEventSchema } from './game-stats.js';

const pageEventsSchema = z
  .array(GameStatEventSchema)
  .max(STAT_HISTORY_PAGE_SIZE)
  .refine(
    (events) =>
      events.every((event, index) => index === 0 || events[index - 1].sequence < event.sequence),
    'A page holds its events in sequence order.',
  );

export const GameStatHistoryFirstPageSchema = z.strictObject({
  events: pageEventsSchema,
  pageCount: z.number().int().positive(),
  leagueType: leagueTypeSchema,
  teamIds: z.array(teamIdSchema).min(1).max(2),
  rosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  absentRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  nonScoringRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
});
export type GameStatHistoryFirstPage = z.infer<typeof GameStatHistoryFirstPageSchema>;

export const GameStatHistoryContinuationPageSchema = z.strictObject({
  events: pageEventsSchema.refine(
    (events) => events.length > 0,
    'A continuation page holds events.',
  ),
});
export type GameStatHistoryContinuationPage = z.infer<typeof GameStatHistoryContinuationPageSchema>;

// Both page shapes are strict, so a first page missing part of its snapshot is refused rather than
// read as a continuation page.
export const GameStatHistoryPageSchema = z.union([
  GameStatHistoryFirstPageSchema,
  GameStatHistoryContinuationPageSchema,
]);
export type GameStatHistoryPage = z.infer<typeof GameStatHistoryPageSchema>;
