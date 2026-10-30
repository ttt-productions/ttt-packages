import { SPORT_LINE_SCHEMAS } from '../doc-schemas/aggregate-stats.js';
import type {
  BasketballPlayerTotals,
  BasketballTeamSeasonStats,
} from '../doc-schemas/aggregate-stats.js';
import type { BasketballPlayerStats } from '../doc-schemas/game-stats.js';
import {
  BASKETBALL_PLAYER_STAT_KEYS,
  BASKETBALL_STAT_EVENT_TYPE_KEYS,
  BASKETBALL_TEAM_STAT_KEYS,
  SPORT_KEY_BY_LEAGUE_TYPE,
} from '../types/sports.js';
import {
  BASKETBALL_BULK_ENTRY,
  BASKETBALL_EVENT_LABELS,
  BASKETBALL_FIELD_LABELS,
  BASKETBALL_SCOREBOARD,
  BASKETBALL_SCORING,
  BASKETBALL_SCORING_PANEL,
  describeBasketballEvent,
  emptyBasketballTeamLine,
} from './basketball-scoring.js';
import type { ColumnSort, StatColumn } from './column-catalog.js';
import { lifetimeSummaryFromColumns } from './lifetime-summary.js';
import {
  GAMES_PLAYED_COLUMN,
  TEAM_SEASON_BASE_COLUMN,
  TEAM_SEASON_BASE_COLUMNS,
} from './shared-columns.js';
import type { SportAdapter } from './sport-adapter.js';

const POINTS = { id: 'points', label: 'Points', shortLabel: 'PTS' } as const;
const POINTS_PER_GAME = {
  id: 'pointsPerGame',
  label: 'Points per game',
  shortLabel: 'PPG',
} as const;
const REBOUNDS = { id: 'rebounds', label: 'Rebounds', shortLabel: 'REB' } as const;
const REBOUNDS_PER_GAME = {
  id: 'reboundsPerGame',
  label: 'Rebounds per game',
  shortLabel: 'RPG',
} as const;
const ASSISTS = { id: 'assists', label: 'Assists', shortLabel: 'AST' } as const;
const ASSISTS_PER_GAME = {
  id: 'assistsPerGame',
  label: 'Assists per game',
  shortLabel: 'APG',
} as const;
const FANTASY_POINTS = { id: 'fantasyPoints', label: 'Fantasy points', shortLabel: 'FP' } as const;
const FANTASY_POINTS_PER_GAME = {
  id: 'fantasyPointsPerGame',
  label: 'Fantasy points per game',
  shortLabel: 'FP/G',
} as const;

const BY_POINTS: readonly ColumnSort[] = [{ columnId: POINTS.id, direction: 'desc' }];

const playerTotalsColumns: readonly StatColumn<BasketballPlayerTotals>[] = [
  GAMES_PLAYED_COLUMN,
  { ...POINTS, value: (line) => line.points, perGame: POINTS_PER_GAME, sort: 'desc' },
  { ...REBOUNDS, value: (line) => line.rebounds, perGame: REBOUNDS_PER_GAME, sort: 'desc' },
  { ...ASSISTS, value: (line) => line.assists, perGame: ASSISTS_PER_GAME, sort: 'desc' },
  {
    ...FANTASY_POINTS,
    value: (line) => line.fantasyPoints,
    perGame: FANTASY_POINTS_PER_GAME,
    sort: 'desc',
  },
];

const gamePlayerColumns: readonly StatColumn<BasketballPlayerStats>[] = [
  { ...POINTS, value: (line) => line.points, sort: 'desc' },
  { ...REBOUNDS, value: (line) => line.rebounds, sort: 'desc' },
  { ...ASSISTS, value: (line) => line.assists, sort: 'desc' },
  { ...FANTASY_POINTS, value: (line) => line.fantasyPoints, sort: 'desc' },
];

const teamSeasonColumns: readonly StatColumn<BasketballTeamSeasonStats>[] = [
  ...TEAM_SEASON_BASE_COLUMNS,
  { ...REBOUNDS, value: (line) => line.rebounds, perGame: REBOUNDS_PER_GAME, sort: 'desc' },
  { ...ASSISTS, value: (line) => line.assists, perGame: ASSISTS_PER_GAME, sort: 'desc' },
];

export const BASKETBALL_ADAPTER: SportAdapter<'Basketball'> = {
  leagueType: 'Basketball',
  sportKey: SPORT_KEY_BY_LEAGUE_TYPE.Basketball,
  eventTypes: BASKETBALL_STAT_EVENT_TYPE_KEYS,
  teamStatKeys: BASKETBALL_TEAM_STAT_KEYS,
  playerStatKeys: BASKETBALL_PLAYER_STAT_KEYS,
  hallOfFame: true,
  historicalBaseline: true,
  lineSchemas: SPORT_LINE_SCHEMAS.Basketball,
  ...BASKETBALL_SCORING,
  display: {
    label: 'Basketball',
    iconKey: 'basketballBall',
    lifetimeSummary: lifetimeSummaryFromColumns(playerTotalsColumns),
    eventLabels: BASKETBALL_EVENT_LABELS,
    fieldLabels: BASKETBALL_FIELD_LABELS,
    describeEvent: describeBasketballEvent,
    scoreboard: BASKETBALL_SCOREBOARD,
    scoringPanel: BASKETBALL_SCORING_PANEL,
  },
  columns: {
    playerTotals: {
      columns: playerTotalsColumns,
      defaultSort: BY_POINTS,
      presets: [
        {
          id: 'totals',
          label: 'Totals',
          columnIds: [
            GAMES_PLAYED_COLUMN.id,
            POINTS.id,
            REBOUNDS.id,
            ASSISTS.id,
            FANTASY_POINTS.id,
          ],
        },
        {
          id: 'perGame',
          label: 'Per game',
          columnIds: [
            GAMES_PLAYED_COLUMN.id,
            POINTS_PER_GAME.id,
            REBOUNDS_PER_GAME.id,
            ASSISTS_PER_GAME.id,
            FANTASY_POINTS_PER_GAME.id,
          ],
        },
      ],
    },
    gamePlayer: {
      columns: gamePlayerColumns,
      defaultSort: BY_POINTS,
      defaultLayout: [POINTS.id, REBOUNDS.id, ASSISTS.id, FANTASY_POINTS.id],
    },
    teamSeason: {
      columns: teamSeasonColumns,
      defaultSort: [
        { columnId: TEAM_SEASON_BASE_COLUMN.wins.id, direction: 'desc' },
        { columnId: TEAM_SEASON_BASE_COLUMN.losses.id, direction: 'asc' },
        { columnId: TEAM_SEASON_BASE_COLUMN.pointDifferential.id, direction: 'desc' },
      ],
      defaultLayout: [
        TEAM_SEASON_BASE_COLUMN.wins.id,
        TEAM_SEASON_BASE_COLUMN.losses.id,
        TEAM_SEASON_BASE_COLUMN.pointsFor.id,
        TEAM_SEASON_BASE_COLUMN.pointsAgainst.id,
        TEAM_SEASON_BASE_COLUMN.pointDifferential.id,
        REBOUNDS.id,
        ASSISTS.id,
      ],
    },
  },
  emptyStats: (game) => ({
    teamStats: Object.fromEntries(
      game.teamIds.map((teamId) => [teamId, emptyBasketballTeamLine()]),
    ),
    playerStats: {},
  }),
  bulkEntry: BASKETBALL_BULK_ENTRY,
};
