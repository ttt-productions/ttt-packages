// The curling adapter: team-scored by end, with no individual stats — every present roster entry is
// credited a game played — and no hall of fame. Its scoring, display, and bulk-entry members are in
// ./curling-scoring.ts.

import { SPORT_LINE_SCHEMAS } from '../doc-schemas/aggregate-stats.js';
import {
  CURLING_PLAYER_STAT_KEYS,
  CURLING_STAT_EVENT_TYPE_KEYS,
  CURLING_TEAM_STAT_KEYS,
  SPORT_KEY_BY_LEAGUE_TYPE,
} from '../types/sports.js';
import {
  CURLING_BULK_ENTRY,
  CURLING_EVENT_LABELS,
  CURLING_FIELD_LABELS,
  CURLING_ROUNDS,
  CURLING_SCOREBOARD,
  CURLING_SCORING,
  CURLING_SCORING_PANEL,
  describeCurlingEvent,
  emptyCurlingTeamLine,
} from './curling-scoring.js';
import { lifetimeSummaryFromColumns } from './lifetime-summary.js';
import { GAMES_PLAYED_COLUMN, TEAM_SEASON_BASE_COLUMN, TEAM_SEASON_BASE_COLUMNS } from './shared-columns.js';
import type { SportAdapter } from './sport-adapter.js';

const playerTotalsColumns = [GAMES_PLAYED_COLUMN];

export const CURLING_ADAPTER: SportAdapter<'Curling'> = {
  leagueType: 'Curling',
  sportKey: SPORT_KEY_BY_LEAGUE_TYPE.Curling,
  eventTypes: CURLING_STAT_EVENT_TYPE_KEYS,
  teamStatKeys: CURLING_TEAM_STAT_KEYS,
  playerStatKeys: CURLING_PLAYER_STAT_KEYS,
  hallOfFame: false,
  historicalBaseline: false,
  lineSchemas: SPORT_LINE_SCHEMAS.Curling,
  ...CURLING_SCORING,
  display: {
    label: 'Curling',
    iconKey: 'curlingStone',
    lifetimeSummary: lifetimeSummaryFromColumns(playerTotalsColumns),
    eventLabels: CURLING_EVENT_LABELS,
    fieldLabels: CURLING_FIELD_LABELS,
    describeEvent: describeCurlingEvent,
    rounds: CURLING_ROUNDS,
    scoreboard: CURLING_SCOREBOARD,
    scoringPanel: CURLING_SCORING_PANEL,
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
        { columnId: TEAM_SEASON_BASE_COLUMN.pointsFor.id, direction: 'desc' },
      ],
      defaultLayout: [
        TEAM_SEASON_BASE_COLUMN.wins.id,
        TEAM_SEASON_BASE_COLUMN.losses.id,
        TEAM_SEASON_BASE_COLUMN.ties.id,
        TEAM_SEASON_BASE_COLUMN.pointsFor.id,
      ],
    },
  },
  emptyStats: (game) => ({
    teamStats: Object.fromEntries(game.teamIds.map((teamId) => [teamId, emptyCurlingTeamLine()])),
    playerStats: {},
  }),
  bulkEntry: CURLING_BULK_ENTRY,
};
