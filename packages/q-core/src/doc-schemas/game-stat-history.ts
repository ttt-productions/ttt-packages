// `sportGames/{gameId}/gameStatHistory/{pageId}` — a completed game's finalized record: every event
// document of the game, exactly as stored and in `sequence` order, in pages of up to
// STAT_HISTORY_PAGE_SIZE, the page ids from `buildStatHistoryPageId(index)`.
//
// The first page also carries what finalize applied: the sport, the teams, and the participation
// snapshot, so the record alone reproduces a completed game's contribution without the game
// document a hand edit can reach (SPORT-204). It exists exactly while the game is `completed`.

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

// A game whose replay is its empty stats has a first page and no events.
export const GameStatHistoryFirstPageSchema = z.strictObject({
  events: pageEventsSchema,
  pageCount: z.number().int().positive(),
  leagueType: leagueTypeSchema,
  teamIds: z.array(teamIdSchema).min(1).max(2),
  // The participation snapshot, as roster-entry ids.
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
