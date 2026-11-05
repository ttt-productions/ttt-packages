import { describe, it, expect } from 'vitest';
import {
  CAPACITY_LIMITS,
  GAME_LOCATIONS_FULL_MESSAGE,
  MAX_OFFERED_WAIVER_TEMPLATES,
  WAIVER_TEMPLATES_FULL_MESSAGE,
  GAME_STAT_LOG_FULL_MESSAGE,
  LEAGUE_GAMES_FULL_MESSAGE,
  LEAGUE_TEAMS_FULL_MESSAGE,
  MAX_ACTIVE_TEAM_MEMBERS,
  MAX_GAME_LOCATIONS,
  MAX_GAME_LOCATION_SUB_LOCATIONS,
  MAX_GAMES_PER_LEAGUE,
  MAX_PLAYOFF_CUTOFF,
  MAX_ROSTER_ENTRIES_PER_TEAM,
  MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM,
  MAX_SCHEDULE_WEEK_GAMES,
  MAX_STAT_EVENTS_PER_GAME,
  MAX_TEAMS_PER_GAME,
  MAX_TEAMS_PER_LEAGUE,
  SCHEDULE_WEEK_FULL_MESSAGE,
  GAME_COMPLETED_DELETE_MESSAGE,
  TEAM_FULL_MESSAGE,
  WEEK_HAS_COMPLETED_GAMES_DELETE_LEAD,
  countCapReachedMessage,
  gameRosterBound,
  gameSideFullMessage,
  scheduledGameLabel,
  weekHasCompletedGamesDeleteMessage,
} from '../src/constants/business.js';
import { GameStatHistoryRecordSchema } from '../src/doc-schemas/game-stat-history.js';
import { GameLocationRegistrySchema } from '../src/doc-schemas/game-location.js';
import { BasketballGameSchema } from '../src/doc-schemas/sport-game.js';
import { WaiverTemplateRegistrySchema } from '../src/doc-schemas/waiver-template.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';

describe('a team holds at most 30 players, ghost players included', () => {
  it('declares the cap and seeds a game roster from every member a full team can hold', () => {
    expect(MAX_ACTIVE_TEAM_MEMBERS).toBe(30);
    expect(MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM).toBe(MAX_ACTIVE_TEAM_MEMBERS);
  });

  it('holds on a game side as many people as a team holds, so a full team fits on it', () => {
    expect(MAX_ROSTER_ENTRIES_PER_TEAM).toBe(MAX_ACTIVE_TEAM_MEMBERS);
    expect(MAX_ROSTER_ENTRIES_PER_TEAM).toBe(30);
    expect(MAX_ROSTER_ENTRIES_PER_TEAM).toBe(MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM);
  });

  it("bounds a game's whole roster by a full side for each of its teams", () => {
    expect(gameRosterBound(['team-a', 'team-b'])).toBe(60);
    expect(gameRosterBound(['team-a'])).toBe(MAX_ROSTER_ENTRIES_PER_TEAM);
  });

  it('names the game whose side is full', () => {
    const game = scheduledGameLabel('Week 3', '2026-03-04');
    expect(game).toBe('The Week 3 game on 2026-03-04');
    expect(gameSideFullMessage(game)).toBe(
      "The Week 3 game on 2026-03-04 already has the maximum of 30 people on this team's side.",
    );
  });

  it("refuses to delete a completed game, or a week holding one, naming the week's completed games", () => {
    expect(GAME_COMPLETED_DELETE_MESSAGE).toBe('This game is completed, so it cannot be deleted.');
    expect(
      weekHasCompletedGamesDeleteMessage([
        'Hoopers vs Dunkers (2026-03-04)',
        'A vs B (2026-03-05)',
      ]),
    ).toBe(
      'This week has completed games, which cannot be deleted: Hoopers vs Dunkers (2026-03-04); A vs B (2026-03-05).',
    );
    expect(
      weekHasCompletedGamesDeleteMessage(['x']).startsWith(WEEK_HAS_COMPLETED_GAMES_DELETE_LEAD),
    ).toBe(true);
  });

  it('says the team is full, with its limit', () => {
    expect(TEAM_FULL_MESSAGE).toBe('This team already has the maximum of 30 players.');
  });
});

describe('a game is played between at most two teams', () => {
  it('declares the cap, and a game and its stats history hold no more teams than it', () => {
    expect(MAX_TEAMS_PER_GAME).toBe(2);
    const teams = (count: number) => Array.from({ length: count }, (_, index) => `team-${index}`);
    for (const teamIds of [
      BasketballGameSchema.shape.teamIds,
      GameStatHistoryRecordSchema.shape.teamIds,
    ]) {
      expect(teamIds.safeParse(teams(MAX_TEAMS_PER_GAME)).success).toBe(true);
      expect(teamIds.safeParse(teams(MAX_TEAMS_PER_GAME + 1)).success).toBe(false);
    }
  });
});

describe('a league holds at most 40 teams and 250 games', () => {
  it('declares both caps', () => {
    expect(MAX_TEAMS_PER_LEAGUE).toBe(40);
    expect(MAX_GAMES_PER_LEAGUE).toBe(250);
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
    expect(GAME_STAT_LOG_FULL_MESSAGE).toBe(
      'This game already has the maximum of 1000 recorded stats.',
    );
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
    expect(GameLocationRegistrySchema.parse({ locationRevision: 3 })).toEqual({
      locationRevision: 3,
    });
    expect(GameLocationRegistrySchema.parse({ locationRevision: 3, count: 3 })).toEqual({
      locationRevision: 3,
    });
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
    expect(PATH_BUILDERS.waiverTemplateRegistry()).toEqual([
      '_serverData',
      'waiverTemplateRegistry',
    ]);
    expect(WaiverTemplateRegistrySchema.parse({ templateRevision: 2 })).toEqual({
      templateRevision: 2,
    });
    expect(WaiverTemplateRegistrySchema.parse({ templateRevision: 2, count: 2 })).toEqual({
      templateRevision: 2,
    });
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

  it('names the game side limit in plain words', () => {
    const side = CAPACITY_LIMITS.find((entry) => entry.key === 'gameSidePeople');
    expect(side?.label).toBe('People on one side of one game');
  });
});

describe('countCapReachedMessage', () => {
  it('names what is full, its limit, and what it holds', () => {
    expect(countCapReachedMessage('This list', 3, 'items')).toBe(
      'This list already has the maximum of 3 items.',
    );
  });
});
