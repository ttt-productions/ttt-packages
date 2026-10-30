import type { AdminView } from '../constants/admin-views.js';
import type { SportKey } from '../types/sports.js';

export const HALL_OF_FAME_SPORT_PARAM = 'sport';

export const ADMIN_VIEW_PARAM = 'view';

export const ADMIN_SECTION_PARAM = 'section';

export const ADMIN_LEAGUE_PARAM = 'league';

export const ADMIN_TEAM_PARAM = 'team';

export const ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS = [
  'settings',
  'schedule',
  'teams',
  'free-agents',
] as const;
export type AdminLeagueWorkspaceSection = (typeof ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS)[number];

export const LEAGUE_SCHEDULE_SECTION = 'schedule' satisfies AdminLeagueWorkspaceSection;

export const LEAGUE_TEAMS_SECTION = 'teams' satisfies AdminLeagueWorkspaceSection;

export const LEAGUE_FREE_AGENTS_SECTION = 'free-agents' satisfies AdminLeagueWorkspaceSection;

const enc = encodeURIComponent;

function withQuery(path: string, entries: readonly (readonly [string, string])[]): string {
  if (entries.length === 0) return path;
  return `${path}?${entries.map(([key, value]) => `${key}=${enc(value)}`).join('&')}`;
}

function adminLeagueEntries(
  leagueId: string,
  section?: AdminLeagueWorkspaceSection,
): (readonly [string, string])[] {
  return [
    [ADMIN_VIEW_PARAM, 'leagues' satisfies AdminView],
    [ADMIN_LEAGUE_PARAM, leagueId],
    ...(section === undefined ? [] : [[ADMIN_SECTION_PARAM, section] as const]),
  ];
}

export const APP_ROUTES = {
  home: (): string => '/',
  hallOfFame: (sport?: SportKey): string =>
    withQuery('/hall-of-fame', sport === undefined ? [] : [[HALL_OF_FAME_SPORT_PARAM, sport]]),
  locations: (): string => '/locations',
  settings: (): string => '/settings',
  terms: (): string => '/terms',
  user: (userId: string): string => `/user/${enc(userId)}`,
  league: (leagueId: string): string => `/league/${enc(leagueId)}`,
  leagueTeam: (leagueId: string, teamId: string): string =>
    `/league/${enc(leagueId)}/team/${enc(teamId)}`,
  sportGame: (leagueId: string, gameId: string): string =>
    `/league/${enc(leagueId)}/game/${enc(gameId)}`,
  sportGameScoring: (leagueId: string, gameId: string): string =>
    `/league/${enc(leagueId)}/game/${enc(gameId)}/stats`,
  admin: (view?: AdminView): string =>
    withQuery(
      '/admin',
      view === undefined || view === 'dashboard' ? [] : [[ADMIN_VIEW_PARAM, view]],
    ),
  adminLeague: (leagueId: string, section?: AdminLeagueWorkspaceSection): string =>
    withQuery('/admin', adminLeagueEntries(leagueId, section)),
  adminLeagueTeam: (leagueId: string, teamId: string): string =>
    withQuery('/admin', [
      ...adminLeagueEntries(leagueId, LEAGUE_TEAMS_SECTION),
      [ADMIN_TEAM_PARAM, teamId],
    ]),
} as const;
