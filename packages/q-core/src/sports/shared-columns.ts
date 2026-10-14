// Columns every sport's catalogs share. A column's id is stable — a saved table layout stores it —
// so an id never names a different figure later.

import type { TeamSeasonBaseStats } from '../doc-schemas/aggregate-stats.js';
import type { GamesPlayedRow, StatColumn } from './column-catalog.js';

// Games played (GP) is in every player-totals and standings catalog, and has no per-game variant.
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

// Derived at read; no line stores a differential.
const POINT_DIFFERENTIAL: StatColumn<TeamSeasonBaseStats> = {
  id: 'pointDifferential',
  label: 'Point differential',
  shortLabel: '+/-',
  value: (line) => line.pointsFor - line.pointsAgainst,
  sort: 'desc',
};

// The standings base every sport's season line carries, by key so a sport's layout and standings
// order name its columns. W, L, T, and the differential have no per-game variant.
export const TEAM_SEASON_BASE_COLUMN = {
  gamesPlayed: GAMES_PLAYED_COLUMN,
  wins: WINS,
  losses: LOSSES,
  ties: TIES,
  pointsFor: POINTS_FOR,
  pointsAgainst: POINTS_AGAINST,
  pointDifferential: POINT_DIFFERENTIAL,
} as const;

/** The standings base in catalog order; each sport composes it with its own extras and layout. */
export const TEAM_SEASON_BASE_COLUMNS: readonly StatColumn<TeamSeasonBaseStats>[] = [
  GAMES_PLAYED_COLUMN,
  WINS,
  LOSSES,
  TIES,
  POINTS_FOR,
  POINTS_AGAINST,
  POINT_DIFFERENTIAL,
];
