// The app addresses both roots link to: each is one path segment per id, every id encoded so an id
// holding a `/` or a space still addresses its own page, and an admin section always rides in the
// one query-string key.

import { describe, it, expect } from 'vitest';
import {
  ADMIN_LEAGUES_HREF,
  ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS,
  ADMIN_SECTION_PARAM,
  ADMIN_TEAM_PARAM,
  LEAGUE_FREE_AGENTS_SECTION,
  LEAGUE_SCHEDULE_SECTION,
  LEAGUE_TEAMS_SECTION,
  adminLeagueHref,
  adminLeagueTeamHref,
  leagueHref,
  leagueTeamHref,
  sportGameHref,
  sportGameScoringHref,
  withAdminSection,
} from '../src/utils/app-routes.js';

describe("a league's pages", () => {
  it('addresses the league, a team, a game, and its scoring page under the league', () => {
    expect(leagueHref('l1')).toBe('/league/l1');
    expect(leagueTeamHref('l1', 't1')).toBe('/league/l1/team/t1');
    expect(sportGameHref('l1', 'g1')).toBe('/league/l1/game/g1');
    expect(sportGameScoringHref('l1', 'g1')).toBe('/league/l1/game/g1/stats');
  });

  it('encodes every id, so an id holding a slash or a space stays one segment', () => {
    expect(leagueHref('a/b')).toBe('/league/a%2Fb');
    expect(leagueTeamHref('l 1', 't/1')).toBe('/league/l%201/team/t%2F1');
    expect(sportGameScoringHref('l1', 'g/1')).toBe('/league/l1/game/g%2F1/stats');
  });
});

describe('the admin Leagues workspace', () => {
  it('names a league on the Leagues view, on a section only when one is named', () => {
    expect(ADMIN_LEAGUES_HREF).toBe('/admin?view=leagues');
    expect(adminLeagueHref('league-1')).toBe('/admin?view=leagues&league=league-1');
    expect(adminLeagueHref('a/b c')).toBe('/admin?view=leagues&league=a%2Fb%20c');
    expect(adminLeagueHref('league-1', 'settings')).toBe(
      '/admin?view=leagues&league=league-1&section=settings',
    );
  });

  it("links a free-agent signup's card to the league's free agents", () => {
    expect(ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS).toContain(LEAGUE_FREE_AGENTS_SECTION);
    expect(adminLeagueHref('league-1', LEAGUE_FREE_AGENTS_SECTION)).toBe(
      '/admin?view=leagues&league=league-1&section=free-agents',
    );
  });

  it("links a league's schedule to its Schedule & games section", () => {
    expect(ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS).toContain(LEAGUE_SCHEDULE_SECTION);
    expect(adminLeagueHref('league-1', LEAGUE_SCHEDULE_SECTION)).toBe(
      '/admin?view=leagues&league=league-1&section=schedule',
    );
  });

  it("lists a league's teams on its Teams section, and opens one team's admin view there by its id", () => {
    expect(ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS).toContain(LEAGUE_TEAMS_SECTION);
    expect(adminLeagueHref('league-1', LEAGUE_TEAMS_SECTION)).toBe(
      '/admin?view=leagues&league=league-1&section=teams',
    );
    expect(ADMIN_TEAM_PARAM).toBe('team');
    expect(adminLeagueTeamHref('league-1', 'team 1/a')).toBe(
      '/admin?view=leagues&league=league-1&section=teams&team=team%201%2Fa',
    );
  });

  it('puts any admin section in the one query-string key, joined after a view when there is one', () => {
    expect(ADMIN_SECTION_PARAM).toBe('section');
    expect(withAdminSection('/admin?view=setup', 'waivers')).toBe(
      '/admin?view=setup&section=waivers',
    );
    expect(withAdminSection('/admin', 'a b')).toBe('/admin?section=a%20b');
  });
});
