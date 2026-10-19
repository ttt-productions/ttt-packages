// The aggregate tier of the stats model: every league-wide and career number, each a derived cache
// of the completed games' finalized records (SPORT-201). None is ever written by a client.
//
//   leagueTeams/{teamId}.seasonStats                    the team's standings line
//   leagueTeams/{teamId}.playerSeasonStats.{userId}     one membership's row — the team's league and
//                                                       the key name the membership it belongs to
//   userProfiles/{userId}.lifetimeStats.{sportKey}      a real player's career line per sport
//   sportHallOfFame/{sportKey}                          a sport's all-time leaderboard
//
// Which schema each sport's line of each kind uses — game lines included — is declared once, in
// `SPORT_LINE_SCHEMAS`: the sport's adapter reads its lines through it, and every document field
// holding lines of those kinds is built from it — the game's `stats` (`SPORT_GAME_STATS_SCHEMAS`),
// the season lines, the membership rows, the lifetime lines, and the hall-of-fame entries. A
// document on its own does not say which sport it counts, so a stored line is read as one sport's
// line only through that sport's adapter, never by its shape (SPORT-002). The lines are strict, so a
// line from one sport is never mistaken for another's with fields silently dropped.

import { z } from 'zod';
import { LEAGUE_TYPE_KEYS, SPORT_KEY_BY_LEAGUE_TYPE } from '../types/sports.js';
import type { LeagueType } from '../types/sports.js';
import type { StatLineKind } from '../types/stats.js';
import { countSchema, epochMsSchema, userIdSchema } from './atoms.js';
import {
  BasketballPlayerStatsSchema,
  BasketballTeamStatsSchema,
  CurlingTeamStatsSchema,
  FootballTeamStatsSchema,
} from './game-stats.js';

// ---------------------------------------------------------------------------------------------
// Team season lines
// ---------------------------------------------------------------------------------------------

// The standings base every sport's season line carries. The point differential derives at read.
const teamSeasonBaseShape = {
  gamesPlayed: countSchema,
  wins: countSchema,
  losses: countSchema,
  ties: countSchema,
  pointsFor: countSchema,
  pointsAgainst: countSchema,
};

export const TeamSeasonBaseStatsSchema = z.strictObject(teamSeasonBaseShape);
export type TeamSeasonBaseStats = z.infer<typeof TeamSeasonBaseStatsSchema>;

// Rebounds and assists are summed from the team's players' game lines; no team line carries FP.
export const BasketballTeamSeasonStatsSchema = z.strictObject({
  ...teamSeasonBaseShape,
  rebounds: countSchema,
  assists: countSchema,
});
export type BasketballTeamSeasonStats = z.infer<typeof BasketballTeamSeasonStatsSchema>;

// ---------------------------------------------------------------------------------------------
// Player lines that carry games played: membership rows, lifetime lines, hall-of-fame entries
// ---------------------------------------------------------------------------------------------

// A sport with no individual stats counts games played only.
export const GamesPlayedStatsSchema = z.strictObject({
  gamesPlayed: countSchema,
});
export type GamesPlayedStats = z.infer<typeof GamesPlayedStatsSchema>;

// The basketball game line — its counters and FP — plus games played.
export const BasketballPlayerTotalsSchema = BasketballPlayerStatsSchema.extend({
  gamesPlayed: countSchema,
});
export type BasketballPlayerTotals = z.infer<typeof BasketballPlayerTotalsSchema>;

// ---------------------------------------------------------------------------------------------
// Every sport's lines, by kind
// ---------------------------------------------------------------------------------------------

// A kind a sport keeps no line of is `z.never()`: curling and football keep no player game line and
// no hall of fame.
export const SPORT_LINE_SCHEMAS = {
  Basketball: {
    gamePlayer: BasketballPlayerStatsSchema,
    membershipRow: BasketballPlayerTotalsSchema,
    lifetime: BasketballPlayerTotalsSchema,
    hallOfFame: BasketballPlayerTotalsSchema,
    gameTeam: BasketballTeamStatsSchema,
    teamSeason: BasketballTeamSeasonStatsSchema,
  },
  Curling: {
    gamePlayer: z.never(),
    membershipRow: GamesPlayedStatsSchema,
    lifetime: GamesPlayedStatsSchema,
    hallOfFame: z.never(),
    gameTeam: CurlingTeamStatsSchema,
    teamSeason: TeamSeasonBaseStatsSchema,
  },
  Football: {
    gamePlayer: z.never(),
    membershipRow: GamesPlayedStatsSchema,
    lifetime: GamesPlayedStatsSchema,
    hallOfFame: z.never(),
    gameTeam: FootballTeamStatsSchema,
    teamSeason: TeamSeasonBaseStatsSchema,
  },
} as const satisfies Record<LeagueType, Record<StatLineKind, z.ZodType>>;

// A stored line of one kind, whichever sport it counts.
function lineOfAnySport<K extends StatLineKind>(kind: K) {
  return z.union(LEAGUE_TYPE_KEYS.map((leagueType) => SPORT_LINE_SCHEMAS[leagueType][kind]));
}

export const TeamSeasonStatsSchema = lineOfAnySport('teamSeason');
export type TeamSeasonStats = z.infer<typeof TeamSeasonStatsSchema>;

// A row exists because a game roster named the player, and outlives the membership.
export const PlayerSeasonStatsSchema = lineOfAnySport('membershipRow');
export type PlayerSeasonStats = z.infer<typeof PlayerSeasonStatsSchema>;

// Keyed by sport key, each sport's lifetime line. A sport the user never played is absent, not
// zeroed. Ghosts never hold one (SPORT-208).
type LifetimeLinesShape = {
  [L in LeagueType as (typeof SPORT_KEY_BY_LEAGUE_TYPE)[L]]: z.ZodOptional<
    (typeof SPORT_LINE_SCHEMAS)[L]['lifetime']
  >;
};

export const UserLifetimeStatsSchema = z.strictObject(
  Object.fromEntries(
    LEAGUE_TYPE_KEYS.map(
      (leagueType) =>
        [
          SPORT_KEY_BY_LEAGUE_TYPE[leagueType],
          SPORT_LINE_SCHEMAS[leagueType].lifetime.optional(),
        ] as const,
    ),
  ) as LifetimeLinesShape,
);
export type UserLifetimeStats = z.infer<typeof UserLifetimeStatsSchema>;

// `sportHallOfFame/{sportKey}` — kept only for a sport whose adapter keeps a hall of fame. Real users
// only (SPORT-208); an entry equals that user's lifetime line for the sport.
export const SportHallOfFameSchema = z.object({
  playerStats: z.record(userIdSchema, lineOfAnySport('hallOfFame')),
  updatedAt: epochMsSchema,
});
export type SportHallOfFame = z.infer<typeof SportHallOfFameSchema>;
