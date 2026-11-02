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

export const TeamSeasonBaseStatsSchema = z.object(teamSeasonBaseShape);
export type TeamSeasonBaseStats = z.infer<typeof TeamSeasonBaseStatsSchema>;

export const BasketballTeamSeasonStatsSchema = z.object({
  ...teamSeasonBaseShape,
  rebounds: countSchema,
  assists: countSchema,
});
export type BasketballTeamSeasonStats = z.infer<typeof BasketballTeamSeasonStatsSchema>;

export const GamesPlayedStatsSchema = z.object({
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

type LifetimeLinesShape = {
  [L in LeagueType as (typeof SPORT_KEY_BY_LEAGUE_TYPE)[L]]: z.ZodOptional<
    (typeof SPORT_LINE_SCHEMAS)[L]['lifetime']
  >;
};

export const UserLifetimeStatsSchema = z.object(
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

function sportHallOfFameOf<L extends LeagueType>(leagueType: L) {
  return z.object({
    leagueType: z.literal(leagueType),
    playerStats: z.record(userIdSchema, SPORT_LINE_SCHEMAS[leagueType].hallOfFame),
    updatedAt: epochMsSchema,
  });
}

export const BasketballHallOfFameSchema = sportHallOfFameOf('Basketball');
export type BasketballHallOfFame = z.infer<typeof BasketballHallOfFameSchema>;

export const CurlingHallOfFameSchema = sportHallOfFameOf('Curling');
export type CurlingHallOfFame = z.infer<typeof CurlingHallOfFameSchema>;

export const FootballHallOfFameSchema = sportHallOfFameOf('Football');
export type FootballHallOfFame = z.infer<typeof FootballHallOfFameSchema>;

export const SportHallOfFameSchema = z.discriminatedUnion('leagueType', [
  BasketballHallOfFameSchema,
  CurlingHallOfFameSchema,
  FootballHallOfFameSchema,
]);
export type SportHallOfFame = z.infer<typeof SportHallOfFameSchema>;
