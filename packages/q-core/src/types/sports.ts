export const LEAGUE_TYPE_KEYS = ['Basketball', 'Curling', 'Football'] as const;
export type LeagueType = (typeof LEAGUE_TYPE_KEYS)[number];

export const SPORT_KEYS = ['basketball', 'curling', 'football'] as const;
export type SportKey = (typeof SPORT_KEYS)[number];

export const SPORT_KEY_BY_LEAGUE_TYPE = {
  Basketball: 'basketball',
  Curling: 'curling',
  Football: 'football',
} as const satisfies Record<LeagueType, SportKey>;

export const LEAGUE_TYPE_BY_SPORT_KEY = {
  basketball: 'Basketball',
  curling: 'Curling',
  football: 'Football',
} as const satisfies Record<SportKey, LeagueType>;

export const SPORT_ICON_KEYS = ['basketballBall', 'curlingStone', 'footballBall'] as const;
export type SportIconKey = (typeof SPORT_ICON_KEYS)[number];

export const STAT_COUNTER_KEYS = ['score', 'timeouts', 'points', 'rebounds', 'assists'] as const;
export type StatCounterKey = (typeof STAT_COUNTER_KEYS)[number];

export const BASKETBALL_TEAM_STAT_KEYS = [
  'score',
  'timeouts',
] as const satisfies readonly StatCounterKey[];
export type BasketballTeamStatKey = (typeof BASKETBALL_TEAM_STAT_KEYS)[number];

export const BASKETBALL_PLAYER_STAT_KEYS = [
  'points',
  'rebounds',
  'assists',
] as const satisfies readonly StatCounterKey[];
export type BasketballPlayerStatKey = (typeof BASKETBALL_PLAYER_STAT_KEYS)[number];

export const BASKETBALL_BULK_STAT_KEYS = BASKETBALL_PLAYER_STAT_KEYS;
export type BasketballBulkStatKey = BasketballPlayerStatKey;

export const BASKETBALL_ONE_POINT_EVENT_TYPE = '1PT';
export const BASKETBALL_TWO_POINT_EVENT_TYPE = '2PT';
export const BASKETBALL_THREE_POINT_EVENT_TYPE = '3PT';
export const BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS = [
  BASKETBALL_TWO_POINT_EVENT_TYPE,
  BASKETBALL_THREE_POINT_EVENT_TYPE,
] as const;
export const BASKETBALL_SCORE_EVENT_TYPE_KEYS = [
  BASKETBALL_ONE_POINT_EVENT_TYPE,
  ...BASKETBALL_ASSISTABLE_SHOT_EVENT_TYPE_KEYS,
] as const;
export const BASKETBALL_REBOUND_EVENT_TYPE = 'REBOUND';
export const BASKETBALL_ASSIST_EVENT_TYPE = 'ASSIST';
export const BASKETBALL_PLAYER_TALLY_EVENT_TYPE_KEYS = [
  BASKETBALL_REBOUND_EVENT_TYPE,
  BASKETBALL_ASSIST_EVENT_TYPE,
] as const;
export const BASKETBALL_TIMEOUT_EVENT_TYPE = 'TIMEOUT';
export const BASKETBALL_BULK_EDIT_EVENT_TYPE = 'BULK_EDIT';

export const BASKETBALL_STAT_EVENT_TYPE_KEYS = [
  ...BASKETBALL_SCORE_EVENT_TYPE_KEYS,
  ...BASKETBALL_PLAYER_TALLY_EVENT_TYPE_KEYS,
  BASKETBALL_TIMEOUT_EVENT_TYPE,
  BASKETBALL_BULK_EDIT_EVENT_TYPE,
] as const;
export type BasketballStatEventType = (typeof BASKETBALL_STAT_EVENT_TYPE_KEYS)[number];

export const CURLING_TEAM_STAT_KEYS = ['score'] as const satisfies readonly StatCounterKey[];
export type CurlingTeamStatKey = (typeof CURLING_TEAM_STAT_KEYS)[number];
export const CURLING_PLAYER_STAT_KEYS = [] as const satisfies readonly StatCounterKey[];

export const CURLING_ROUND_SCORE_EVENT_TYPE = 'CURLING_ROUND_SCORE';
export const CURLING_ROUND_BLANK_EVENT_TYPE = 'CURLING_ROUND_BLANK';
export const CURLING_STAT_EVENT_TYPE_KEYS = [
  CURLING_ROUND_SCORE_EVENT_TYPE,
  CURLING_ROUND_BLANK_EVENT_TYPE,
] as const;
export type CurlingStatEventType = (typeof CURLING_STAT_EVENT_TYPE_KEYS)[number];

export const FOOTBALL_TEAM_STAT_KEYS = ['score'] as const satisfies readonly StatCounterKey[];
export type FootballTeamStatKey = (typeof FOOTBALL_TEAM_STAT_KEYS)[number];
export const FOOTBALL_PLAYER_STAT_KEYS = [] as const satisfies readonly StatCounterKey[];

export const FOOTBALL_SIX_POINT_EVENT_TYPE = 'FOOTBALL_6PT';
export const FOOTBALL_TWO_POINT_EVENT_TYPE = 'FOOTBALL_2PT';
export const FOOTBALL_ONE_POINT_EVENT_TYPE = 'FOOTBALL_1PT';
export const FOOTBALL_SCORE_EVENT_TYPE_KEYS = [
  FOOTBALL_SIX_POINT_EVENT_TYPE,
  FOOTBALL_TWO_POINT_EVENT_TYPE,
  FOOTBALL_ONE_POINT_EVENT_TYPE,
] as const;
export const FOOTBALL_BULK_EDIT_EVENT_TYPE = 'FOOTBALL_BULK_EDIT';
export const FOOTBALL_STAT_EVENT_TYPE_KEYS = [
  ...FOOTBALL_SCORE_EVENT_TYPE_KEYS,
  FOOTBALL_BULK_EDIT_EVENT_TYPE,
] as const;
export type FootballStatEventType = (typeof FOOTBALL_STAT_EVENT_TYPE_KEYS)[number];
