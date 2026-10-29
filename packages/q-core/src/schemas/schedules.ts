// Callable contracts for a league's schedule: a week created with its games, a week's shared fields
// edited, a week deleted with its games; one game added to a week, edited — moved, rescheduled, or
// its teams replaced — or deleted. Every one is admin authority, and the acting admin is
// `request.auth.uid`, never an input field (RULE-STD-ARCH-106). Venue labels, calendar days, the sport, and
// every stat field are derived by the server, never sent.

import { z } from 'zod';
import { MAX_SCHEDULE_WEEK_GAMES } from '../constants/business.js';
import { textFieldSchema } from '../doc-schemas/atoms.js';
import { SCHEDULE_WEEK_TITLE_INPUT_FORMAT } from '../input-formats/input-formats.js';
import {
  countSchema,
  epochMsSchema,
  gameIdSchema,
  leagueIdSchema,
  scheduleWeekIdSchema,
  statsOperationIdSchema,
  teamIdSchema,
} from '../doc-schemas/atoms.js';
import { gameLocationIdSchema } from '../doc-schemas/game-location.js';
import { isByeTeamId } from '../ids/minted-ids.js';
import { SCHEDULE_WEEK_FIELD_KEYS, SPORT_GAME_SCHEDULE_FIELD_KEYS } from '../types/schedules.js';
import { gameLocationSubLocationSchema } from './game-locations.js';

export const scheduleWeekTitleSchema = textFieldSchema(SCHEDULE_WEEK_TITLE_INPUT_FORMAT);

// A game's two team slots, by position: team one, then team two. A slot names a team of the league
// or BYE_TEAM_ID; a game has at least one real team, and never one team twice.
export const scheduleGameTeamsSchema = z
  .tuple([teamIdSchema, teamIdSchema])
  .refine(
    ([first, second]) => !(isByeTeamId(first) && isByeTeamId(second)),
    'A game needs at least one team.',
  )
  .refine(([first, second]) => first !== second, 'A game needs two different teams.');
export type ScheduleGameTeams = z.infer<typeof scheduleGameTeamsSchema>;

// Where and when one game is played. The venue is named by id, and the server writes the label the
// schedule shows from the venue's own name and the chosen court.
const scheduleGameShape = {
  teams: scheduleGameTeamsSchema,
  startTime: epochMsSchema,
  gameLocationId: gameLocationIdSchema,
  subLocation: gameLocationSubLocationSchema.optional(),
};

export const ScheduleGameInputSchema = z.object(scheduleGameShape).strict();
export type ScheduleGameInput = z.infer<typeof ScheduleGameInputSchema>;

export const sportGameScheduleFieldSchema = z.enum(SPORT_GAME_SCHEDULE_FIELD_KEYS);
export const scheduleWeekFieldSchema = z.enum(SCHEDULE_WEEK_FIELD_KEYS);

// A new week and its games, saved together. `weekStartDate` is the week's first day as the admin's
// form reads it; the week's venue is the default each game's form starts from, and its name is the
// week's `weekLocation`.
export const AdminCreateScheduleWeekInputSchema = z
  .object({
    leagueId: leagueIdSchema,
    weekTitle: scheduleWeekTitleSchema,
    weekStartDate: epochMsSchema,
    weekGameLocationId: gameLocationIdSchema,
    games: z.array(ScheduleGameInputSchema).min(1).max(MAX_SCHEDULE_WEEK_GAMES),
  })
  .strict();
export type AdminCreateScheduleWeekInput = z.infer<typeof AdminCreateScheduleWeekInputSchema>;
export const AdminCreateScheduleWeekResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    weekId: scheduleWeekIdSchema,
    gameIds: z.array(gameIdSchema),
  })
  .strict();
export type AdminCreateScheduleWeekResult = z.infer<typeof AdminCreateScheduleWeekResultSchema>;

// Only the week's shared fields the admin changed: a field left out keeps what each game holds, so
// two admins editing different fields of one week never write each other's loaded values back
// (RULE-STD-BACKEND-116). The venue is named by id, and the week shows its name.
export const AdminUpdateScheduleWeekInputSchema = z
  .object({
    leagueId: leagueIdSchema,
    weekId: scheduleWeekIdSchema,
    weekTitle: scheduleWeekTitleSchema.optional(),
    weekStartDate: epochMsSchema.optional(),
    weekGameLocationId: gameLocationIdSchema.optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.weekTitle !== undefined ||
      input.weekStartDate !== undefined ||
      input.weekGameLocationId !== undefined,
    'Name at least one field to change.',
  );
export type AdminUpdateScheduleWeekInput = z.infer<typeof AdminUpdateScheduleWeekInputSchema>;
export const AdminUpdateScheduleWeekResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    weekId: scheduleWeekIdSchema,
    changedFields: z.array(scheduleWeekFieldSchema),
    gamesUpdated: countSchema,
  })
  .strict();
export type AdminUpdateScheduleWeekResult = z.infer<typeof AdminUpdateScheduleWeekResultSchema>;

// A whole week and every game in it. A game with events takes more than one step to delete, so a
// call that runs out of time answers `complete: false` with the games still standing, and running
// it again continues. A week with no game left answers complete.
export const AdminDeleteScheduleWeekInputSchema = z
  .object({ leagueId: leagueIdSchema, weekId: scheduleWeekIdSchema })
  .strict();
export type AdminDeleteScheduleWeekInput = z.infer<typeof AdminDeleteScheduleWeekInputSchema>;
export const AdminDeleteScheduleWeekResultSchema = z
  .object({
    leagueId: leagueIdSchema,
    weekId: scheduleWeekIdSchema,
    deletedGameIds: z.array(gameIdSchema),
    remainingGameIds: z.array(gameIdSchema),
    complete: z.boolean(),
  })
  .strict();
export type AdminDeleteScheduleWeekResult = z.infer<typeof AdminDeleteScheduleWeekResultSchema>;

// One game added to a saved week, which gives it the week's shared fields.
export const AdminCreateSportGameInputSchema = z
  .object({ leagueId: leagueIdSchema, weekId: scheduleWeekIdSchema, ...scheduleGameShape })
  .strict();
export type AdminCreateSportGameInput = z.infer<typeof AdminCreateSportGameInputSchema>;
export const AdminCreateSportGameResultSchema = z
  .object({ leagueId: leagueIdSchema, weekId: scheduleWeekIdSchema, gameId: gameIdSchema })
  .strict();
export type AdminCreateSportGameResult = z.infer<typeof AdminCreateSportGameResultSchema>;

// One game's schedule, whole: its week (a reschedule into another saved week), its teams, its start
// time, and its venue. `expectedUpdatedAt` is the game's `updatedAt` as the admin loaded it, so a
// stale form never writes its old values over a newer change. A game that names no venue may keep
// its stored label by naming none; a court is named only with its venue.
export const AdminUpdateSportGameInputSchema = z
  .object({
    gameId: gameIdSchema,
    expectedUpdatedAt: epochMsSchema,
    weekId: scheduleWeekIdSchema,
    teams: scheduleGameTeamsSchema,
    startTime: epochMsSchema,
    gameLocationId: gameLocationIdSchema.optional(),
    subLocation: gameLocationSubLocationSchema.optional(),
  })
  .strict()
  .refine((input) => input.subLocation === undefined || input.gameLocationId !== undefined, {
    message: 'A court is chosen within a venue.',
    path: ['subLocation'],
  });
export type AdminUpdateSportGameInput = z.infer<typeof AdminUpdateSportGameInputSchema>;
export const AdminUpdateSportGameResultSchema = z
  .object({
    gameId: gameIdSchema,
    changedFields: z.array(sportGameScheduleFieldSchema),
    updatedAt: epochMsSchema,
  })
  .strict();
export type AdminUpdateSportGameResult = z.infer<typeof AdminUpdateSportGameResultSchema>;

// One game, with its events and roster. The server derives the deletion's operation id from the
// game (`buildGameDeletionOperationId`), so a retry of a finished delete is acknowledged and a retry
// of an interrupted one continues it; the caller names only the game.
export const AdminDeleteSportGameInputSchema = z.object({ gameId: gameIdSchema }).strict();
export type AdminDeleteSportGameInput = z.infer<typeof AdminDeleteSportGameInputSchema>;
export const AdminDeleteSportGameResultSchema = z
  .object({ gameId: gameIdSchema, operationId: statsOperationIdSchema, complete: z.boolean() })
  .strict();
export type AdminDeleteSportGameResult = z.infer<typeof AdminDeleteSportGameResultSchema>;
