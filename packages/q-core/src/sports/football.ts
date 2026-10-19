// The football adapter: team-scored, with no individual stats — every present roster entry is
// credited a game played — no finish rule, and no hall of fame. Its scoring, display, and
// bulk-entry members are in ./football-scoring.ts.

import { SPORT_LINE_SCHEMAS } from '../doc-schemas/aggregate-stats.js';
import {
  FOOTBALL_PLAYER_STAT_KEYS,
  FOOTBALL_STAT_EVENT_TYPE_KEYS,
  FOOTBALL_TEAM_STAT_KEYS,
  SPORT_KEY_BY_LEAGUE_TYPE,
} from '../types/sports.js';
import {
  FOOTBALL_BULK_ENTRY,
  FOOTBALL_EVENT_LABELS,
  FOOTBALL_FIELD_LABELS,
  FOOTBALL_SCOREBOARD,
  FOOTBALL_SCORING,
  FOOTBALL_SCORING_PANEL,
  describeFootballEvent,
  emptyFootballTeamLine,
} from './football-scoring.js';
import { lifetimeSummaryFromColumns } from './lifetime-summary.js';
import {
  GAMES_PLAYED_COLUMN,
  TEAM_SEASON_BASE_COLUMN,
  TEAM_SEASON_BASE_COLUMNS,
} from './shared-columns.js';
import type { SportAdapter } from './sport-adapter.js';

const playerTotalsColumns = [GAMES_PLAYED_COLUMN];

export const FOOTBALL_ADAPTER: SportAdapter<'Football'> = {
  leagueType: 'Football',
  sportKey: SPORT_KEY_BY_LEAGUE_TYPE.Football,
  eventTypes: FOOTBALL_STAT_EVENT_TYPE_KEYS,
  teamStatKeys: FOOTBALL_TEAM_STAT_KEYS,
  playerStatKeys: FOOTBALL_PLAYER_STAT_KEYS,
  hallOfFame: false,
  historicalBaseline: false,
  lineSchemas: SPORT_LINE_SCHEMAS.Football,
  ...FOOTBALL_SCORING,
  display: {
    label: 'Football',
    iconKey: 'footballBall',
    lifetimeSummary: lifetimeSummaryFromColumns(playerTotalsColumns),
    eventLabels: FOOTBALL_EVENT_LABELS,
    fieldLabels: FOOTBALL_FIELD_LABELS,
    describeEvent: describeFootballEvent,
    scoreboard: FOOTBALL_SCOREBOARD,
    scoringPanel: FOOTBALL_SCORING_PANEL,
  },
  columns: {
    playerTotals: {
      columns: playerTotalsColumns,
      defaultSort: [{ columnId: GAMES_PLAYED_COLUMN.id, direction: 'desc' }],
      defaultLayout: [GAMES_PLAYED_COLUMN.id],
    },
    // No player game line, so the game page renders no player table.
    gamePlayer: { columns: [], defaultSort: [], defaultLayout: [] },
    teamSeason: {
      columns: TEAM_SEASON_BASE_COLUMNS,
      defaultSort: [
        { columnId: TEAM_SEASON_BASE_COLUMN.wins.id, direction: 'desc' },
        { columnId: TEAM_SEASON_BASE_COLUMN.losses.id, direction: 'asc' },
        { columnId: TEAM_SEASON_BASE_COLUMN.pointDifferential.id, direction: 'desc' },
      ],
      defaultLayout: [
        TEAM_SEASON_BASE_COLUMN.wins.id,
        TEAM_SEASON_BASE_COLUMN.losses.id,
        TEAM_SEASON_BASE_COLUMN.ties.id,
        TEAM_SEASON_BASE_COLUMN.pointsFor.id,
        TEAM_SEASON_BASE_COLUMN.pointsAgainst.id,
      ],
    },
  },
  emptyStats: (game) => ({
    teamStats: Object.fromEntries(game.teamIds.map((teamId) => [teamId, emptyFootballTeamLine()])),
    playerStats: {},
  }),
  bulkEntry: FOOTBALL_BULK_ENTRY,
};
