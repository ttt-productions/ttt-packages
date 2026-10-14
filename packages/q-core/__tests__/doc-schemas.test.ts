import { describe, it, expect } from 'vitest';
import { BASKETBALL_POINTS_BY_EVENT_TYPE, CURLING_ROUND_COUNT } from '../src/constants/sports';
import { DomainEventSchema } from '../src/domain-events';
import {
  GameStatEventSchema,
  SportGameSchema,
  TeamMembershipSchema,
  SignedWaiverSchema,
} from '../src/doc-schemas';
import {
  BASKETBALL_STAT_EVENT_TYPE_KEYS,
  LEAGUE_TYPE_BY_SPORT_KEY,
  LEAGUE_TYPE_KEYS,
  SPORT_KEYS,
  SPORT_KEY_BY_LEAGUE_TYPE,
} from '../src/types/sports';
import { CAPTAIN_TEAM_ROLES, TEAM_ROLE_KEYS } from '../src/types/unions';

const NOW = 1712345678901;

const game = {
  leagueId: 'L',
  weekId: 'week-2024-04-05',
  weekTitle: 'Week 1',
  weekLocation: 'Main Gym',
  weekStartDate: NOW,
  startTime: NOW,
  dayKey: '2024-04-05',
  locationLabel: 'Main Gym - Court 2',
  status: 'scheduled',
  teams: [{ teamId: 'T1' }, { teamId: 'T2' }],
  teamIds: ['T1', 'T2'],
  score: { T1: 0, T2: 0 },
  statEventSequence: 0,
  absentRosterPlayerIds: [],
  createdAt: NOW,
  updatedAt: NOW,
};

const basketballStats = {
  teamStats: { T1: { score: 0, timeouts: 0 }, T2: { score: 0, timeouts: 0 } },
  playerStats: {},
};

describe('sport discriminator', () => {
  it('maps every league type to a sport key and back', () => {
    for (const leagueType of LEAGUE_TYPE_KEYS) {
      expect(LEAGUE_TYPE_BY_SPORT_KEY[SPORT_KEY_BY_LEAGUE_TYPE[leagueType]]).toBe(leagueType);
    }
    expect(Object.values(SPORT_KEY_BY_LEAGUE_TYPE).sort()).toEqual([...SPORT_KEYS].sort());
  });

  it('gives every basketball event type a point value', () => {
    expect(Object.keys(BASKETBALL_POINTS_BY_EVENT_TYPE).sort()).toEqual([...BASKETBALL_STAT_EVENT_TYPE_KEYS].sort());
  });
});

describe('team roles', () => {
  it('stores player, and member is no role value', () => {
    expect(TEAM_ROLE_KEYS).toContain('player');
    expect(TEAM_ROLE_KEYS).not.toContain('member');
    expect(CAPTAIN_TEAM_ROLES).toEqual(['captain', 'coCaptain']);
    const member = {
      leagueId: 'L',
      teamId: 'T',
      userId: 'u1',
      status: 'active',
      isGhost: false,
      joinedAt: NOW,
      updatedAt: NOW,
    };
    expect(TeamMembershipSchema.safeParse({ ...member, role: 'player' }).success).toBe(true);
    expect(TeamMembershipSchema.safeParse({ ...member, role: 'member' }).success).toBe(false);
    expect(TeamMembershipSchema.safeParse({ ...member, role: 'cocaptain' }).success).toBe(false);
  });
});

describe('timestamps are epoch-millisecond numbers', () => {
  it('rejects an ISO string and a Timestamp-shaped object', () => {
    const basketballGame = { ...game, leagueType: 'Basketball', stats: basketballStats };
    expect(SportGameSchema.safeParse(basketballGame).success).toBe(true);
    expect(SportGameSchema.safeParse({ ...basketballGame, startTime: '2024-04-05T19:30:00.000Z' }).success).toBe(false);
    expect(SportGameSchema.safeParse({ ...basketballGame, startTime: { seconds: 1, nanoseconds: 0 } }).success).toBe(
      false,
    );
  });
});

describe('league game', () => {
  it('selects the stats shape from leagueType', () => {
    const unplayedEnds = Array(CURLING_ROUND_COUNT).fill(null);
    const curlingStats = {
      teamStats: { T1: { score: 0, roundScores: unplayedEnds }, T2: { score: 0, roundScores: unplayedEnds } },
      playerStats: {},
    };
    expect(SportGameSchema.safeParse({ ...game, leagueType: 'Curling', stats: curlingStats }).success).toBe(true);
    expect(SportGameSchema.safeParse({ ...game, leagueType: 'Basketball', stats: curlingStats }).success).toBe(false);
    expect(SportGameSchema.safeParse({ ...game, leagueType: 'Hockey', stats: basketballStats }).success).toBe(false);
  });
});

describe('stat events', () => {
  const shot = {
    eventId: 'e1',
    sequence: 1,
    teamId: 'T1',
    playerUserId: 'u1',
    recordedAt: NOW,
  };

  it('accepts each declared shape', () => {
    expect(GameStatEventSchema.safeParse({ ...shot, type: '3PT', assistedByUserId: 'u2' }).success).toBe(true);
    expect(GameStatEventSchema.safeParse({ ...shot, type: 'REBOUND' }).success).toBe(true);
    expect(GameStatEventSchema.safeParse({ ...shot, type: 'BULK_EDIT', stat: 'points', value: -2 }).success).toBe(true);
    expect(
      GameStatEventSchema.safeParse({
        eventId: 'e2',
        sequence: 2,
        type: 'CURLING_ROUND_SCORE',
        teamId: 'T1',
        roundNumber: 3,
        points: 2,
        recordedAt: NOW,
      }).success,
    ).toBe(true);
    expect(
      GameStatEventSchema.safeParse({
        eventId: 'e3',
        sequence: 3,
        type: 'CURLING_ROUND_BLANK',
        roundNumber: 4,
        recordedAt: NOW,
      }).success,
    ).toBe(true);
  });

  it('rejects the undeclared FOUL type and an out-of-range curling round', () => {
    expect(GameStatEventSchema.safeParse({ ...shot, type: 'FOUL' }).success).toBe(false);
    expect(
      GameStatEventSchema.safeParse({
        eventId: 'e4',
        sequence: 4,
        type: 'CURLING_ROUND_SCORE',
        teamId: 'T1',
        roundNumber: CURLING_ROUND_COUNT + 1,
        points: 5,
        recordedAt: NOW,
      }).success,
    ).toBe(false);
  });
});

describe('waiver signature', () => {
  it('requires the wording the signer saw', () => {
    const signature = {
      leagueId: 'L',
      userId: 'u1',
      waiverTemplateId: 'w1',
      waiverTitleSnapshot: 'Waiver',
      signatureFile: { bucket: 'q-sports-dev.appspot.com', path: 'signatures/u1/sig.png' },
      signedAt: NOW,
    };
    expect(SignedWaiverSchema.safeParse(signature).success).toBe(false);
    expect(SignedWaiverSchema.safeParse({ ...signature, waiverTextSnapshot: 'I agree.' }).success).toBe(true);
  });
});

describe('domain events', () => {
  it('parses a declared event and rejects an unknown type or a stray id', () => {
    expect(DomainEventSchema.safeParse({ type: 'sportGame.finalized', ids: { leagueId: 'L', gameId: 'g1' } }).success).toBe(
      true,
    );
    expect(DomainEventSchema.safeParse({ type: 'stats.recalculated', ids: {} }).success).toBe(true);
    expect(DomainEventSchema.safeParse({ type: 'sportGame.exploded', ids: {} }).success).toBe(false);
    expect(
      DomainEventSchema.safeParse({ type: 'league.created', ids: { leagueId: 'L', queryKey: 'leagues' } }).success,
    ).toBe(false);
  });
});
