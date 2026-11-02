import { z } from 'zod';
import { MAX_STAT_HISTORY_PAGES, STAT_HISTORY_PAGE_SIZE } from '../constants/sports.js';
import { buildStatHistoryPageId } from '../ids/stat-event-ids.js';
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

export const GameStatHistoryFirstPageSchema = z.object({
  events: pageEventsSchema,
  pageCount: z.number().int().positive().max(MAX_STAT_HISTORY_PAGES),
  leagueType: leagueTypeSchema,
  teamIds: z.array(teamIdSchema).min(1).max(2),
  rosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  absentRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  nonScoringRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
});
export type GameStatHistoryFirstPage = z.infer<typeof GameStatHistoryFirstPageSchema>;

export const GameStatHistoryContinuationPageSchema = z.object({
  events: pageEventsSchema.refine(
    (events) => events.length > 0,
    'A continuation page holds events.',
  ),
});
export type GameStatHistoryContinuationPage = z.infer<typeof GameStatHistoryContinuationPageSchema>;

export const GameStatHistoryPageSchema = z.union([
  GameStatHistoryFirstPageSchema,
  GameStatHistoryContinuationPageSchema,
]);
export type GameStatHistoryPage = z.infer<typeof GameStatHistoryPageSchema>;

// Both page shapes are plain, so a first page missing part of its snapshot still parses as a
// continuation page under the union. A page's id says which shape it holds: parsing by id refuses it.
export function statHistoryPageSchemaFor(
  pageId: string,
): typeof GameStatHistoryFirstPageSchema | typeof GameStatHistoryContinuationPageSchema {
  return pageId === buildStatHistoryPageId(0)
    ? GameStatHistoryFirstPageSchema
    : GameStatHistoryContinuationPageSchema;
}
