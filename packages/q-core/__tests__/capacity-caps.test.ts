// The capacity limits that keep a team, a league, a week, and a game complete: creation and admission
// are refused at them, so every read of the whole set fits its bound and every commit sized from one
// fits a transaction.

import { describe, it, expect } from 'vitest';
import {
  AWARD_GROUP_GRANT_PAGE_SIZE,
  CAPACITY_LIMITS,
  GAME_LOCATIONS_FULL_MESSAGE,
  MAX_OFFERED_WAIVER_TEMPLATES,
  WAIVER_TEMPLATES_FULL_MESSAGE,
  GAME_STAT_LOG_FULL_MESSAGE,
  LEAGUE_GAMES_FULL_MESSAGE,
  LEAGUE_TEAMS_FULL_MESSAGE,
  MAX_ACTIVE_TEAM_MEMBERS,
  MAX_DEPARTED_ROSTER_ENTRIES_PER_TEAM,
  MAX_GAME_LOCATIONS,
  MAX_GAME_LOCATION_SUB_LOCATIONS,
  MAX_GAMES_PER_LEAGUE,
  MAX_PLAYOFF_CUTOFF,
  MAX_ROSTER_ENTRIES_PER_TEAM,
  MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM,
  MAX_SCHEDULE_WEEK_GAMES,
  MAX_STAT_EVENTS_PER_GAME,
  MAX_TEAMS_PER_LEAGUE,
  SCHEDULE_WEEK_FULL_MESSAGE,
  TEAM_FULL_MESSAGE,
  countCapReachedMessage,
} from '../src/constants/business';
import { GameLocationRegistrySchema } from '../src/doc-schemas/game-location';
import { WaiverTemplateRegistrySchema } from '../src/doc-schemas/waiver-template';
import { PATH_BUILDERS } from '../src/paths/path-builders';

// The most writes one Firestore transaction commits.
const TRANSACTION_WRITES = 500;

describe('a team holds at most 30 players, ghost players included', () => {
  it('declares the cap and seeds a game roster from every member a full team can hold', () => {
    expect(MAX_ACTIVE_TEAM_MEMBERS).toBe(30);
    expect(MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM).toBe(MAX_ACTIVE_TEAM_MEMBERS);
  });

  it("reads a game side's 30 players plus the 10 departed players who recorded stats in it", () => {
    expect(MAX_DEPARTED_ROSTER_ENTRIES_PER_TEAM).toBe(10);
    expect(MAX_ROSTER_ENTRIES_PER_TEAM).toBe(40);
  });

  it('says the team is full, with its limit', () => {
    expect(TEAM_FULL_MESSAGE).toBe('This team already has the maximum of 30 players.');
  });
});

describe('a league holds at most 40 teams and 250 games', () => {
  it('declares both caps', () => {
    expect(MAX_TEAMS_PER_LEAGUE).toBe(40);
    expect(MAX_GAMES_PER_LEAGUE).toBe(250);
  });

  it("fits a full league's mode switch in one transaction: every team, the league, and its audit event", () => {
    expect(MAX_TEAMS_PER_LEAGUE + 2).toBeLessThanOrEqual(TRANSACTION_WRITES);
  });

  it("fits a full league's stats rebuild in one transaction: every team, its audit event, the beacon, and the run's progress", () => {
    expect(MAX_TEAMS_PER_LEAGUE + 3).toBeLessThanOrEqual(TRANSACTION_WRITES);
  });

  it('bounds the playoff cutoff by the teams a league can hold', () => {
    expect(MAX_PLAYOFF_CUTOFF).toBe(MAX_TEAMS_PER_LEAGUE);
  });

  it('says the league is full, with the limit that was reached', () => {
    expect(LEAGUE_TEAMS_FULL_MESSAGE).toBe('This league already has the maximum of 40 teams.');
    expect(LEAGUE_GAMES_FULL_MESSAGE).toBe('This league already has the maximum of 250 games.');
  });
});

describe('a week of the schedule holds at most 20 games', () => {
  it('declares the cap and says the week is full', () => {
    expect(MAX_SCHEDULE_WEEK_GAMES).toBe(20);
    expect(SCHEDULE_WEEK_FULL_MESSAGE).toBe('This week already has the maximum of 20 games.');
  });
});

describe('a game holds at most 1,000 stat events', () => {
  it('declares the cap and says the stat log is full', () => {
    expect(MAX_STAT_EVENTS_PER_GAME).toBe(1000);
    expect(GAME_STAT_LOG_FULL_MESSAGE).toBe('This game already has the maximum of 1000 recorded stats.');
  });
});

describe('Q-Sports holds at most 30 game locations', () => {
  it('declares the cap apart from the courts or sheets inside each venue, and says the venues are full', () => {
    expect(MAX_GAME_LOCATIONS).toBe(30);
    expect(MAX_GAME_LOCATION_SUB_LOCATIONS).toBe(50);
    expect(GAME_LOCATIONS_FULL_MESSAGE).toBe('Q-Sports already has the maximum of 30 locations.');
  });

  it('fences venue creation on one server-only document holding only its revision', () => {
    expect(PATH_BUILDERS.gameLocationRegistry()).toEqual(['_serverData', 'gameLocationRegistry']);
    expect(GameLocationRegistrySchema.parse({ locationRevision: 3 })).toEqual({ locationRevision: 3 });
    expect(GameLocationRegistrySchema.safeParse({ locationRevision: 3, count: 3 }).success).toBe(false);
    expect(GameLocationRegistrySchema.safeParse({ locationRevision: -1 }).success).toBe(false);
  });
});

describe('Q-Sports offers leagues at most 30 waiver templates', () => {
  it('declares the cap and says the offered templates are full', () => {
    expect(MAX_OFFERED_WAIVER_TEMPLATES).toBe(30);
    expect(WAIVER_TEMPLATES_FULL_MESSAGE).toBe(
      'Q-Sports already has the maximum of 30 waiver templates offered to leagues.',
    );
  });

  it('fences template creation on one server-only document holding only its revision', () => {
    expect(PATH_BUILDERS.waiverTemplateRegistry()).toEqual(['_serverData', 'waiverTemplateRegistry']);
    expect(WaiverTemplateRegistrySchema.parse({ templateRevision: 2 })).toEqual({ templateRevision: 2 });
    expect(WaiverTemplateRegistrySchema.safeParse({ templateRevision: 2, count: 2 }).success).toBe(false);
  });
});

describe('a group award grant page', () => {
  it('commits within one transaction: four writes a person beside the grant record', () => {
    expect(AWARD_GROUP_GRANT_PAGE_SIZE * 4 + 1).toBeLessThanOrEqual(TRANSACTION_WRITES);
  });

  it('reaches a whole team in one page', () => {
    expect(AWARD_GROUP_GRANT_PAGE_SIZE).toBeGreaterThanOrEqual(MAX_ACTIVE_TEAM_MEMBERS);
  });
});

describe('the capacity limits an admin reads', () => {
  it('lists every limit once, each the constant the server enforces', () => {
    const byKey = new Map(CAPACITY_LIMITS.map((entry) => [entry.key, entry.limit]));
    expect(byKey.size).toBe(CAPACITY_LIMITS.length);
    expect(Object.fromEntries(byKey)).toEqual({
      teamPlayers: MAX_ACTIVE_TEAM_MEMBERS,
      gameSidePeople: MAX_ROSTER_ENTRIES_PER_TEAM,
      leagueTeams: MAX_TEAMS_PER_LEAGUE,
      leagueGames: MAX_GAMES_PER_LEAGUE,
      weekGames: MAX_SCHEDULE_WEEK_GAMES,
      gameStats: MAX_STAT_EVENTS_PER_GAME,
      playoffCutoff: MAX_PLAYOFF_CUTOFF,
      gameLocations: MAX_GAME_LOCATIONS,
      offeredWaiverTemplates: MAX_OFFERED_WAIVER_TEMPLATES,
    });
  });

  it('says how a game side splits into players and departed players with the same numbers it enforces', () => {
    const side = CAPACITY_LIMITS.find((entry) => entry.key === 'gameSidePeople');
    expect(side?.label).toContain('30 players plus 10 who left the team');
  });
});

describe('countCapReachedMessage', () => {
  it('names what is full, its limit, and what it holds', () => {
    expect(countCapReachedMessage('This list', 3, 'items')).toBe('This list already has the maximum of 3 items.');
  });
});
