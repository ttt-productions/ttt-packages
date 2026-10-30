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

export const scheduleGameTeamsSchema = z
  .tuple([teamIdSchema, teamIdSchema])
  .refine(
    ([first, second]) => !(isByeTeamId(first) && isByeTeamId(second)),
    'A game needs at least one team.',
  )
  .refine(([first, second]) => first !== second, 'A game needs two different teams.');
export type ScheduleGameTeams = z.infer<typeof scheduleGameTeamsSchema>;

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

export const AdminCreateSportGameInputSchema = z
  .object({ leagueId: leagueIdSchema, weekId: scheduleWeekIdSchema, ...scheduleGameShape })
  .strict();
export type AdminCreateSportGameInput = z.infer<typeof AdminCreateSportGameInputSchema>;
export const AdminCreateSportGameResultSchema = z
  .object({ leagueId: leagueIdSchema, weekId: scheduleWeekIdSchema, gameId: gameIdSchema })
  .strict();
export type AdminCreateSportGameResult = z.infer<typeof AdminCreateSportGameResultSchema>;

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

export const AdminDeleteSportGameInputSchema = z.object({ gameId: gameIdSchema }).strict();
export type AdminDeleteSportGameInput = z.infer<typeof AdminDeleteSportGameInputSchema>;
export const AdminDeleteSportGameResultSchema = z
  .object({ gameId: gameIdSchema, operationId: statsOperationIdSchema, complete: z.boolean() })
  .strict();
export type AdminDeleteSportGameResult = z.infer<typeof AdminDeleteSportGameResultSchema>;
