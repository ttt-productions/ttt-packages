// `sportGames/{gameId}` — one scheduled or played game — and its `gameRosterPlayers` subcollection.
// The game is discriminated on `leagueType`, which selects its `stats` shape (SPORT-002).

import { z } from 'zod';
import { parseGameRosterPlayerId } from '../ids/compound-ids.js';
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
  userIdSchema,
} from './atoms.js';
import { gameLocationIdSchema } from './game-location.js';

// Each sport's game `stats`: the two-key payload (SPORT-001) over that sport's game lines, taken
// from `SPORT_LINE_SCHEMAS` — the one pairing of a sport with its lines. Spelled per sport so each
// payload keeps its exact type; `satisfies` fails the build when a sport is missing.
export const SPORT_GAME_STATS_SCHEMAS = {
  Basketball: gameStatsSchema(SPORT_LINE_SCHEMAS.Basketball.gameTeam, SPORT_LINE_SCHEMAS.Basketball.gamePlayer),
  Curling: gameStatsSchema(SPORT_LINE_SCHEMAS.Curling.gameTeam, SPORT_LINE_SCHEMAS.Curling.gamePlayer),
  Football: gameStatsSchema(SPORT_LINE_SCHEMAS.Football.gameTeam, SPORT_LINE_SCHEMAS.Football.gamePlayer),
} as const satisfies Record<LeagueType, z.ZodType>;

export type BasketballGameStats = z.infer<typeof SPORT_GAME_STATS_SCHEMAS.Basketball>;
export type CurlingGameStats = z.infer<typeof SPORT_GAME_STATS_SCHEMAS.Curling>;
export type FootballGameStats = z.infer<typeof SPORT_GAME_STATS_SCHEMAS.Football>;

// Which sport's payload a game holds is decided by its `leagueType`, never by the payload's shape
// (SPORT-002).
export type GameStats = z.infer<(typeof SPORT_GAME_STATS_SCHEMAS)[LeagueType]>;

// One of a game's two team slots. `teamId` is a leagueTeams id, or BYE_TEAM_ID for a bye week.
export const GameTeamSchema = z.object({
  teamId: teamIdSchema,
});
export type GameTeam = z.infer<typeof GameTeamSchema>;

const sportGameBase = {
  leagueId: leagueIdSchema,
  // The week this game belongs to; weekly schedules are reconstructed by grouping on `weekId`.
  weekId: scheduleWeekIdSchema,
  weekTitle: z.string(),
  weekLocation: z.string(),
  weekStartDate: epochMsSchema,
  startTime: epochMsSchema,
  // The game's local calendar date in LEAGUE_TIME_ZONE.
  dayKey: calendarDateSchema,
  // The venue as shown, e.g. "Main Gym - Court 2". Free text; `gameLocationId` is the reference.
  locationLabel: z.string(),
  gameLocationId: gameLocationIdSchema.optional(),
  subLocation: z.string().optional(),
  status: gameStatusSchema,
  // Positional: teams[0] is team one, teams[1] is team two.
  teams: z.tuple([GameTeamSchema, GameTeamSchema]),
  // The real (non-bye) team ids, for `array-contains` queries.
  teamIds: z.array(teamIdSchema).min(1).max(2),
  // Each team's score, mirrored from its `stats.teamStats` line by the same write that changes it
  // (SPORT-107), so a schedule or list reads a score without the stats.
  score: z.record(teamIdSchema, countSchema),
  // The number of this game's stat event documents, which is also the last `sequence` assigned.
  statEventSequence: countSchema,
  // A scorer's note per person, keyed by userId (real or ghost).
  memos: z.record(z.string(), z.string()).optional(),
  // Absence is per roster entry: a person on both teams can be absent on one side only.
  absentRosterPlayerIds: z.array(gameRosterPlayerIdSchema),
  // The roster entries finalize credited no game played — the adapter's decision, stored so every
  // later path reverses what was applied rather than deciding again (SPORT-204). Present only while
  // the game is completed.
  nonScoringRosterPlayerIds: z.array(gameRosterPlayerIdSchema).optional(),
  // Set while a multi-page stats operation holds the game; every other writer of its stats, roster,
  // absence, memos, teams, or existence refuses it until the operation clears it.
  statsOperationId: statsOperationIdSchema.optional(),
  finalizedAt: epochMsSchema.optional(),
  // When reopen last opened the finalized game again; set by reopen and never cleared. Its roster is
  // then the record of who played it, so a membership change no longer reaches it — only a scorer
  // adding a ghost to this game does.
  reopenedAt: epochMsSchema.optional(),
  createdAt: epochMsSchema,
  updatedAt: epochMsSchema,
};

// The rollup holds a line for each of the game's teams and no other, the score mirror names the same
// teams, and every player line is keyed to one of them.
function rollupMatchesTeams(game: {
  teamIds: string[];
  score: Record<string, number>;
  stats: { teamStats: Record<string, unknown>; playerStats: Record<string, unknown> };
}): boolean {
  const teams = new Set(game.teamIds);
  const namesEveryTeam = (keys: string[]) => keys.length === teams.size && keys.every((key) => teams.has(key));
  return (
    namesEveryTeam(Object.keys(game.stats.teamStats)) &&
    namesEveryTeam(Object.keys(game.score)) &&
    Object.keys(game.stats.playerStats).every((key) => teams.has(parseGameRosterPlayerId(key)?.teamId ?? ''))
  );
}
const ROLLUP_MISMATCH = "The stats rollup and score mirror hold exactly the game's teams.";

export const BasketballGameSchema = z
  .object({
    ...sportGameBase,
    leagueType: z.literal('Basketball' satisfies LeagueType),
    stats: SPORT_GAME_STATS_SCHEMAS.Basketball,
    // Which team holds the possession arrow.
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

// `sportGames/{gameId}/gameRosterPlayers/{teamId}_{userId}` — one entry per team per person, the id
// from `buildGameRosterPlayerId`. The roster is the participation authority finalize iterates.
export const GameRosterPlayerSchema = z.object({
  userId: userIdSchema,
  teamId: teamIdSchema,
  isGhost: z.boolean(),
  syncedAt: epochMsSchema,
});
export type GameRosterPlayer = z.infer<typeof GameRosterPlayerSchema>;
