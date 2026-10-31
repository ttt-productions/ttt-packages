import { z } from 'zod';
import { parseGameRosterPlayerId } from '../ids/compound-ids.js';
import {
  GAME_MEMO_INPUT_FORMAT,
  SCHEDULE_WEEK_TITLE_INPUT_FORMAT,
} from '../input-formats/input-formats.js';
import type { LeagueType } from '../types/sports.js';
import { SPORT_LINE_SCHEMAS } from './aggregate-stats.js';
import { gameStatsSchema } from './game-stats.js';
import {
  calendarDateSchema,
  countSchema,
  epochMsSchema,
  gameRosterPlayerIdSchema,
  gameStatusSchema,
  leagueIdSchema,
  scheduleWeekIdSchema,
  statsOperationIdSchema,
  teamIdSchema,
  textFieldSchema,
  userIdSchema,
} from './atoms.js';
import { gameLocationIdSchema, gameLocationSubLocationSchema } from './game-location.js';

// Spelled per sport so each payload keeps its exact type.
export const SPORT_GAME_STATS_SCHEMAS = {
  Basketball: gameStatsSchema(
    SPORT_LINE_SCHEMAS.Basketball.gameTeam,
    SPORT_LINE_SCHEMAS.Basketball.gamePlayer,
  ),
  Curling: gameStatsSchema(
    SPORT_LINE_SCHEMAS.Curling.gameTeam,
    SPORT_LINE_SCHEMAS.Curling.gamePlayer,
  ),
  Football: gameStatsSchema(
    SPORT_LINE_SCHEMAS.Football.gameTeam,
    SPORT_LINE_SCHEMAS.Football.gamePlayer,
  ),
} as const satisfies Record<LeagueType, z.ZodType>;

export type BasketballGameStats = z.infer<typeof SPORT_GAME_STATS_SCHEMAS.Basketball>;
export type CurlingGameStats = z.infer<typeof SPORT_GAME_STATS_SCHEMAS.Curling>;
export type FootballGameStats = z.infer<typeof SPORT_GAME_STATS_SCHEMAS.Football>;

export type GameStats = z.infer<(typeof SPORT_GAME_STATS_SCHEMAS)[LeagueType]>;

export const GameTeamSchema = z.object({
  teamId: teamIdSchema,
});
export type GameTeam = z.infer<typeof GameTeamSchema>;

const sportGameBase = {
  leagueId: leagueIdSchema,
  weekId: scheduleWeekIdSchema,
  weekTitle: textFieldSchema(SCHEDULE_WEEK_TITLE_INPUT_FORMAT),
  weekLocation: z.string(),
  weekStartDate: epochMsSchema,
  startTime: epochMsSchema,
  dayKey: calendarDateSchema,
  locationLabel: z.string(),
  gameLocationId: gameLocationIdSchema.optional(),
  subLocation: gameLocationSubLocationSchema.optional(),
  status: gameStatusSchema,
  teams: z.tuple([GameTeamSchema, GameTeamSchema]),
  teamIds: z.array(teamIdSchema).min(1).max(2),
  score: z.record(teamIdSchema, countSchema),
  statEventSequence: countSchema,
  memos: z.record(z.string(), textFieldSchema(GAME_MEMO_INPUT_FORMAT)).optional(),
  absentRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  nonScoringRosterPlayerIds: z.array(gameRosterPlayerIdSchema).optional(),
  statsOperationId: statsOperationIdSchema.optional(),
  finalizedAt: epochMsSchema.optional(),
  reopenedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
};

function rollupMatchesTeams(game: {
  teamIds: string[];
  score: Record<string, number>;
  stats: { teamStats: Record<string, unknown>; playerStats: Record<string, unknown> };
}): boolean {
  const teams = new Set(game.teamIds);
  const namesEveryTeam = (keys: string[]) =>
    keys.length === teams.size && keys.every((key) => teams.has(key));
  return (
    namesEveryTeam(Object.keys(game.stats.teamStats)) &&
    namesEveryTeam(Object.keys(game.score)) &&
    Object.keys(game.stats.playerStats).every((key) =>
      teams.has(parseGameRosterPlayerId(key)?.teamId ?? ''),
    )
  );
}
const ROLLUP_MISMATCH = "The stats rollup and score mirror hold exactly the game's teams.";

export const BasketballGameSchema = z
  .object({
    ...sportGameBase,
    leagueType: z.literal('Basketball' satisfies LeagueType),
    stats: SPORT_GAME_STATS_SCHEMAS.Basketball,
    jumpBallTeamId: teamIdSchema.optional(),
  })
  .refine(rollupMatchesTeams, ROLLUP_MISMATCH);
export type BasketballGame = z.infer<typeof BasketballGameSchema>;

export const CurlingGameSchema = z
  .object({
    ...sportGameBase,
    leagueType: z.literal('Curling' satisfies LeagueType),
    stats: SPORT_GAME_STATS_SCHEMAS.Curling,
  })
  .refine(rollupMatchesTeams, ROLLUP_MISMATCH);
export type CurlingGame = z.infer<typeof CurlingGameSchema>;

export const FootballGameSchema = z
  .object({
    ...sportGameBase,
    leagueType: z.literal('Football' satisfies LeagueType),
    stats: SPORT_GAME_STATS_SCHEMAS.Football,
  })
  .refine(rollupMatchesTeams, ROLLUP_MISMATCH);
export type FootballGame = z.infer<typeof FootballGameSchema>;

export const SportGameSchema = z.discriminatedUnion('leagueType', [
  BasketballGameSchema,
  CurlingGameSchema,
  FootballGameSchema,
]);
export type SportGame = z.infer<typeof SportGameSchema>;

export const GameRosterPlayerSchema = z.object({
  userId: userIdSchema,
  teamId: teamIdSchema,
  isGhost: z.boolean(),
  syncedAt: epochMsSchema,
});
export type GameRosterPlayer = z.infer<typeof GameRosterPlayerSchema>;
