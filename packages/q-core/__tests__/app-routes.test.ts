// The app addresses both roots link to: each is one path segment per id, every id encoded so an id
// holding a `/` or a space still addresses its own page, and a league workspace's section always
// rides in the one query-string key.

import { describe, it, expect } from 'vitest';
import {
  ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS,
  ADMIN_SECTION_PARAM,
  ADMIN_TEAM_PARAM,
  ADMIN_VIEW_PARAM,
  APP_ROUTES,
  HALL_OF_FAME_SPORT_PARAM,
  LEAGUE_FREE_AGENTS_SECTION,
  LEAGUE_SCHEDULE_SECTION,
  LEAGUE_TEAMS_SECTION,
} from '../src/paths/app-routes.js';
import { ADMIN_VIEWS } from '../src/constants/admin-views.js';
import { SPORT_KEYS } from '../src/types/sports.js';

describe('the fixed pages', () => {
  it('addresses each by its own root', () => {
    expect(APP_ROUTES.home()).toBe('/');
    expect(APP_ROUTES.locations()).toBe('/locations');
    expect(APP_ROUTES.settings()).toBe('/settings');
    expect(APP_ROUTES.terms()).toBe('/terms');
  });

  it("opens the hall of fame plainly, or on one sport's page", () => {
    expect(APP_ROUTES.hallOfFame()).toBe('/hall-of-fame');
    expect(HALL_OF_FAME_SPORT_PARAM).toBe('sport');
    for (const sport of SPORT_KEYS) {
      expect(APP_ROUTES.hallOfFame(sport)).toBe(`/hall-of-fame?sport=${sport}`);
    }
  });
});

describe("a person's and a league's pages", () => {
  it('addresses a profile, the league, a team, a game, and its scoring page under the league', () => {
    expect(APP_ROUTES.user('u1')).toBe('/user/u1');
    expect(APP_ROUTES.league('l1')).toBe('/league/l1');
    expect(APP_ROUTES.leagueTeam('l1', 't1')).toBe('/league/l1/team/t1');
    expect(APP_ROUTES.sportGame('l1', 'g1')).toBe('/league/l1/game/g1');
    expect(APP_ROUTES.sportGameScoring('l1', 'g1')).toBe('/league/l1/game/g1/stats');
  });

  it('encodes every id, so an id holding a slash or a space stays one segment', () => {
    expect(APP_ROUTES.user('a b')).toBe('/user/a%20b');
    expect(APP_ROUTES.league('a/b')).toBe('/league/a%2Fb');
    expect(APP_ROUTES.leagueTeam('l 1', 't/1')).toBe('/league/l%201/team/t%2F1');
    expect(APP_ROUTES.sportGameScoring('l1', 'g/1')).toBe('/league/l1/game/g%2F1/stats');
  });
});

describe('the admin page', () => {
  it('opens the dashboard as the bare page and every other view by its slug', () => {
    expect(APP_ROUTES.admin()).toBe('/admin');
    expect(APP_ROUTES.admin('dashboard')).toBe('/admin');
    expect(ADMIN_VIEW_PARAM).toBe('view');
    for (const view of ADMIN_VIEWS.filter((slug) => slug !== 'dashboard')) {
      expect(APP_ROUTES.admin(view)).toBe(`/admin?view=${view}`);
    }
  });

  it('names a league on the Leagues view, on a section only when one is named', () => {
    expect(ADMIN_SECTION_PARAM).toBe('section');
    expect(APP_ROUTES.adminLeague('league-1')).toBe('/admin?view=leagues&league=league-1');
    expect(APP_ROUTES.adminLeague('a/b c')).toBe('/admin?view=leagues&league=a%2Fb%20c');
    expect(APP_ROUTES.adminLeague('league-1', 'settings')).toBe(
      '/admin?view=leagues&league=league-1&section=settings',
    );
  });

  it("links a free-agent signup's card to the league's free agents", () => {
    expect(ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS).toContain(LEAGUE_FREE_AGENTS_SECTION);
    expect(APP_ROUTES.adminLeague('league-1', LEAGUE_FREE_AGENTS_SECTION)).toBe(
      '/admin?view=leagues&league=league-1&section=free-agents',
    );
  });

  it("links a league's schedule to its Schedule & games section", () => {
    expect(ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS).toContain(LEAGUE_SCHEDULE_SECTION);
    expect(APP_ROUTES.adminLeague('league-1', LEAGUE_SCHEDULE_SECTION)).toBe(
      '/admin?view=leagues&league=league-1&section=schedule',
    );
  });

  it("lists a league's teams on its Teams section, and opens one team's admin view there by its id", () => {
    expect(ADMIN_LEAGUE_WORKSPACE_SECTION_KEYS).toContain(LEAGUE_TEAMS_SECTION);
    expect(APP_ROUTES.adminLeague('league-1', LEAGUE_TEAMS_SECTION)).toBe(
      '/admin?view=leagues&league=league-1&section=teams',
    );
    expect(ADMIN_TEAM_PARAM).toBe('team');
    expect(APP_ROUTES.adminLeagueTeam('league-1', 'team 1/a')).toBe(
      '/admin?view=leagues&league=league-1&section=teams&team=team%201%2Fa',
    );
  });
});
