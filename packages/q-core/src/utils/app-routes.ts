// The app addresses a link is built to: a league's pages — the league, one of its teams, one of its
// games and that game's scoring page — and the admin Leagues workspace. Both roots build these links:
// the server writes one onto an admin notification card, and the app links to every one of them, so
// each address shape has one change point (ARCH-101).

const LEAGUE_PATH = '/league';

/** The one admin page; every admin group is a `?view=` of it. */
export const ADMIN_PATH = '/admin';

/** The query-string key the admin page's groups live under. */
export const ADMIN_VIEW_PARAM = 'view';

/** The query-string key a group's sections live under. */
export const ADMIN_SECTION_PARAM = 'section';

/** The query-string key the Leagues group names the league whose workspace is open under. */
export const ADMIN_LEAGUE_PARAM = 'league';

/** The admin Leagues group: the league list, each league's workspace nested beneath it. */
export const ADMIN_LEAGUES_HREF = '/admin?view=leagues';

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

/** The query-string key the Teams section names the team whose admin view is open under. */
export const ADMIN_TEAM_PARAM = 'team';

/** The league workspace's section listing the league's free-agent signups. */
export const LEAGUE_FREE_AGENTS_SECTION = 'free-agents' satisfies AdminLeagueWorkspaceSection;

/** An admin address on one of its sections — the one place a section joins a link. */
export function withAdminSection(href: string, section: string): string {
  const joiner = href.includes('?') ? '&' : '?';
  return `${href}${joiner}${ADMIN_SECTION_PARAM}=${encodeURIComponent(section)}`;
}

export function leagueHref(leagueId: string): string {
  return `${LEAGUE_PATH}/${encodeURIComponent(leagueId)}`;
}

export function leagueTeamHref(leagueId: string, teamId: string): string {
  return `${leagueHref(leagueId)}/team/${encodeURIComponent(teamId)}`;
}

export function sportGameHref(leagueId: string, gameId: string): string {
  return `${leagueHref(leagueId)}/game/${encodeURIComponent(gameId)}`;
}

/** A game's scoring page, where a scorer records its stats. */
export function sportGameScoringHref(leagueId: string, gameId: string): string {
  return `${sportGameHref(leagueId, gameId)}/stats`;
}

/** A league's admin workspace, on one of its sections when one is named. */
export function adminLeagueHref(leagueId: string, section?: AdminLeagueWorkspaceSection): string {
  const href = `${ADMIN_LEAGUES_HREF}&${ADMIN_LEAGUE_PARAM}=${encodeURIComponent(leagueId)}`;
  return section === undefined ? href : withAdminSection(href, section);
}

/** One team's admin view, inside its league's workspace on the Teams section. */
export function adminLeagueTeamHref(leagueId: string, teamId: string): string {
  return `${adminLeagueHref(leagueId, LEAGUE_TEAMS_SECTION)}&${ADMIN_TEAM_PARAM}=${encodeURIComponent(teamId)}`;
}
