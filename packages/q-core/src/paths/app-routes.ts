// Every app page address, declared once and built through `APP_ROUTES`. Both roots build these
// links: the server writes one onto an admin notification card, and the app links to every one of
// them, so each address shape has one change point (RULE-STD-ARCH-101). Every id is encoded, so an id
// holding a `/` or a space still addresses its own page.

import type { AdminView } from '../constants/admin-views.js';
import type { SportKey } from '../types/sports.js';

/** The query-string key the hall of fame names its sport under. */
export const HALL_OF_FAME_SPORT_PARAM = 'sport';

/** The query-string key the admin page's views live under. */
export const ADMIN_VIEW_PARAM = 'view';

/** The query-string key a league workspace's sections live under. */
export const ADMIN_SECTION_PARAM = 'section';

/** The query-string key the Leagues view names the league whose workspace is open under. */
export const ADMIN_LEAGUE_PARAM = 'league';

/** The query-string key the Teams section names the team whose admin view is open under. */
export const ADMIN_TEAM_PARAM = 'team';

// The sections a league's admin workspace is addressed by. The workspace declares which of them it
// has built as tabs; a link may name any of them.
export const ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS = [
  'settings',
  'schedule',
  'teams',
  'free-agents',
] as const;
export type AdminLeagueWorkspaceSection = (typeof ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS)[number];

/** The league workspace's section holding the league's weeks and games. */
export const LEAGUE_SCHEDULE_SECTION = 'schedule' satisfies AdminLeagueWorkspaceSection;

/** The league workspace's section listing the league's teams, each opening its admin view. */
export const LEAGUE_TEAMS_SECTION = 'teams' satisfies AdminLeagueWorkspaceSection;

/** The league workspace's section listing the league's free-agent signups. */
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
  /** A game's scoring page, where a scorer records its stats. */
  sportGameScoring: (leagueId: string, gameId: string): string =>
    `/league/${enc(leagueId)}/game/${enc(gameId)}/stats`,
  /** An admin view; the dashboard is the bare page. */
  admin: (view?: AdminView): string =>
    withQuery(
      '/admin',
      view === undefined || view === 'dashboard' ? [] : [[ADMIN_VIEW_PARAM, view]],
    ),
  /** A league's admin workspace, on one of its sections when one is named. */
  adminLeague: (leagueId: string, section?: AdminLeagueWorkspaceSection): string =>
    withQuery('/admin', adminLeagueEntries(leagueId, section)),
  /** One team's admin view, inside its league's workspace on the Teams section. */
  adminLeagueTeam: (leagueId: string, teamId: string): string =>
    withQuery('/admin', [
      ...adminLeagueEntries(leagueId, LEAGUE_TEAMS_SECTION),
      [ADMIN_TEAM_PARAM, teamId],
    ]),
} as const;
