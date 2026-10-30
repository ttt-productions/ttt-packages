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

export const BasketballTeamSeasonStatsSchema = z.strictObject({
  ...teamSeasonBaseShape,
  rebounds: countSchema,
  assists: countSchema,
});
export type BasketballTeamSeasonStats = z.infer<typeof BasketballTeamSeasonStatsSchema>;

export const GamesPlayedStatsSchema = z.strictObject({
  gamesPlayed: countSchema,
});
export type GamesPlayedStats = z.infer<typeof GamesPlayedStatsSchema>;

export const BasketballPlayerTotalsSchema = BasketballPlayerStatsSchema.extend({
  gamesPlayed: countSchema,
});
export type BasketballPlayerTotals = z.infer<typeof BasketballPlayerTotalsSchema>;

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

function lineOfAnySport<K extends StatLineKind>(kind: K) {
  return z.union(LEAGUE_TYPE_KEYS.map((leagueType) => SPORT_LINE_SCHEMAS[leagueType][kind]));
}

export const TeamSeasonStatsSchema = lineOfAnySport('teamSeason');
export type TeamSeasonStats = z.infer<typeof TeamSeasonStatsSchema>;

export const PlayerSeasonStatsSchema = lineOfAnySport('membershipRow');
export type PlayerSeasonStats = z.infer<typeof PlayerSeasonStatsSchema>;

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

export const SportHallOfFameSchema = z.object({
  playerStats: z.record(userIdSchema, lineOfAnySport('hallOfFame')),
  updatedAt: epochMsSchema,
});
export type SportHallOfFame = z.infer<typeof SportHallOfFameSchema>;
