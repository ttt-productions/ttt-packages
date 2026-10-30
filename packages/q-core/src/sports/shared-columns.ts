import type { TeamSeasonBaseStats } from '../doc-schemas/aggregate-stats.js';
import type { GamesPlayedRow, StatColumn } from './column-catalog.js';

export const GAMES_PLAYED_COLUMN: StatColumn<GamesPlayedRow> = {
  id: 'gamesPlayed',
  label: 'Games played',
  shortLabel: 'GP',
  value: (line) => line.gamesPlayed,
  sort: 'desc',
};

const WINS: StatColumn<TeamSeasonBaseStats> = {
  id: 'wins',
  label: 'Wins',
  shortLabel: 'W',
  value: (line) => line.wins,
  sort: 'desc',
};

const LOSSES: StatColumn<TeamSeasonBaseStats> = {
  id: 'losses',
  label: 'Losses',
  shortLabel: 'L',
  value: (line) => line.losses,
  sort: 'asc',
};

const TIES: StatColumn<TeamSeasonBaseStats> = {
  id: 'ties',
  label: 'Ties',
  shortLabel: 'T',
  value: (line) => line.ties,
  sort: 'desc',
};

const POINTS_FOR: StatColumn<TeamSeasonBaseStats> = {
  id: 'pointsFor',
  label: 'Points for',
  shortLabel: 'PF',
  value: (line) => line.pointsFor,
  perGame: { id: 'pointsForPerGame', label: 'Points for per game', shortLabel: 'PF/G' },
  sort: 'desc',
};

const POINTS_AGAINST: StatColumn<TeamSeasonBaseStats> = {
  id: 'pointsAgainst',
  label: 'Points against',
  shortLabel: 'PA',
  value: (line) => line.pointsAgainst,
  perGame: { id: 'pointsAgainstPerGame', label: 'Points against per game', shortLabel: 'PA/G' },
  sort: 'asc',
};

const POINT_DIFFERENTIAL: StatColumn<TeamSeasonBaseStats> = {
  id: 'pointDifferential',
  label: 'Point differential',
  shortLabel: '+/-',
  value: (line) => line.pointsFor - line.pointsAgainst,
  sort: 'desc',
};

export const TEAM_SEASON_BASE_COLUMN = {
  gamesPlayed: GAMES_PLAYED_COLUMN,
  wins: WINS,
  losses: LOSSES,
  ties: TIES,
  pointsFor: POINTS_FOR,
  pointsAgainst: POINTS_AGAINST,
  pointDifferential: POINT_DIFFERENTIAL,
} as const;

export const TEAM_SEASON_BASE_COLUMNS: readonly StatColumn<TeamSeasonBaseStats>[] = [
  GAMES_PLAYED_COLUMN,
  WINS,
  LOSSES,
  TIES,
  POINTS_FOR,
  POINTS_AGAINST,
  POINT_DIFFERENTIAL,
];
