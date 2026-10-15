// The caps that keep a team, a league, and a game complete: creation and admission are refused at
// them, so every read of the whole set fits its bound.

import { describe, it, expect } from 'vitest';
import {
  GAME_STAT_LOG_FULL_MESSAGE,
  LEAGUE_GAMES_FULL_MESSAGE,
  LEAGUE_TEAMS_FULL_MESSAGE,
  MAX_ACTIVE_TEAM_MEMBERS,
  MAX_GAMES_PER_LEAGUE,
  MAX_ROSTER_ENTRIES_PER_TEAM,
  MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM,
  MAX_STAT_EVENTS_PER_GAME,
  MAX_TEAMS_PER_LEAGUE,
  TEAM_FULL_MESSAGE,
  countCapReachedMessage,
} from '../src/constants/business';

describe('a team holds at most 100 active members', () => {
  it('seeds a game roster from every member a full team can hold', () => {
    expect(MAX_ACTIVE_TEAM_MEMBERS).toBe(100);
    expect(MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM).toBe(MAX_ACTIVE_TEAM_MEMBERS);
  });

  it("reads a game side's entries for a full team plus the departed players who recorded stats", () => {
    expect(MAX_ROSTER_ENTRIES_PER_TEAM).toBeGreaterThan(MAX_ROSTER_SEED_MEMBERSHIPS_PER_TEAM);
  });

  it('says the team is full, with its limit', () => {
    expect(TEAM_FULL_MESSAGE).toBe('This team already has the maximum of 100 members.');
  });
});

describe('a league holds at most 498 teams and 1,000 games', () => {
  it('fits a mode switch of every team in one 500-write transaction beside the league and its audit event', () => {
    expect(MAX_TEAMS_PER_LEAGUE).toBe(498);
    expect(MAX_TEAMS_PER_LEAGUE + 2).toBeLessThanOrEqual(500);
    expect(MAX_GAMES_PER_LEAGUE).toBe(1000);
  });

  it('says the league is full, with the limit that was reached', () => {
    expect(LEAGUE_TEAMS_FULL_MESSAGE).toBe('This league already has the maximum of 498 teams.');
    expect(LEAGUE_GAMES_FULL_MESSAGE).toBe('This league already has the maximum of 1000 games.');
  });
});

describe('a game holds at most 5,000 stat events', () => {
  it('declares the cap and says the stat log is full', () => {
    expect(MAX_STAT_EVENTS_PER_GAME).toBe(5000);
    expect(GAME_STAT_LOG_FULL_MESSAGE).toBe('This game already has the maximum of 5000 recorded stats.');
  });
});

describe('countCapReachedMessage', () => {
  it('names what is full, its limit, and what it holds', () => {
    expect(countCapReachedMessage('This list', 3, 'items')).toBe('This list already has the maximum of 3 items.');
  });
});
