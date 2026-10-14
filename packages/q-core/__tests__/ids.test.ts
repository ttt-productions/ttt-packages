import { describe, it, expect } from 'vitest';
import {
  BYE_TEAM_ID,
  COMPOUND_ID_SEPARATOR,
  buildLeagueFreeAgentId,
  buildGhostUserId,
  buildSportGameId,
  buildTeamMembershipId,
  buildSignedWaiverId,
  isByeTeamId,
  isGhostUserId,
  parseLeagueFreeAgentId,
  parseTeamMembershipId,
  parseSignedWaiverId,
} from '../src/ids';

const LEAGUE = 'Zx9Qw3Er7Ty1Ui5Op2As';
const TEAM = 'aB3dE5gH7jK9mN1pQ3sT';
const UID = 'aB3dE5gH7jK9mN1pQ3sT5vW7xY9z';
const GHOST = buildGhostUserId(1712345678901, 'ab12cd3');

describe('compound document ids', () => {
  it('builds the formats firestore.rules reconstructs', () => {
    expect(COMPOUND_ID_SEPARATOR).toBe('_');
    expect(buildTeamMembershipId(LEAGUE, TEAM, UID)).toBe(`${LEAGUE}_${TEAM}_${UID}`);
    expect(buildLeagueFreeAgentId(LEAGUE, UID)).toBe(`${LEAGUE}_${UID}`);
    expect(buildSignedWaiverId(LEAGUE, UID)).toBe(`${LEAGUE}_${UID}`);
  });

  it('round-trips a real user id', () => {
    expect(parseTeamMembershipId(buildTeamMembershipId(LEAGUE, TEAM, UID))).toEqual({
      leagueId: LEAGUE,
      teamId: TEAM,
      userId: UID,
    });
    expect(parseLeagueFreeAgentId(buildLeagueFreeAgentId(LEAGUE, UID))).toEqual({ leagueId: LEAGUE, userId: UID });
    expect(parseSignedWaiverId(buildSignedWaiverId(LEAGUE, UID))).toEqual({ leagueId: LEAGUE, userId: UID });
  });

  it('round-trips a ghost user id, whose own underscores stay inside the userId part', () => {
    expect(parseTeamMembershipId(buildTeamMembershipId(LEAGUE, TEAM, GHOST))).toEqual({
      leagueId: LEAGUE,
      teamId: TEAM,
      userId: GHOST,
    });
    expect(parseSignedWaiverId(buildSignedWaiverId(LEAGUE, GHOST))?.userId).toBe(GHOST);
  });

  it('returns null for an id that is not in the format', () => {
    expect(parseTeamMembershipId('')).toBeNull();
    expect(parseTeamMembershipId(LEAGUE)).toBeNull();
    expect(parseTeamMembershipId(`${LEAGUE}_${TEAM}`)).toBeNull();
    expect(parseTeamMembershipId(`${LEAGUE}_${TEAM}_`)).toBeNull();
    expect(parseTeamMembershipId(`_${TEAM}_${UID}`)).toBeNull();
    expect(parseLeagueFreeAgentId(LEAGUE)).toBeNull();
  });
});

describe('minted ids and sentinels', () => {
  it('identifies a ghost by its prefix only', () => {
    expect(GHOST).toBe('ghost_1712345678901_ab12cd3');
    expect(isGhostUserId(GHOST)).toBe(true);
    expect(isGhostUserId(UID)).toBe(false);
  });

  it('mints a game id and recognizes the bye sentinel', () => {
    expect(buildSportGameId(1712345678901, 'k3j9x2')).toBe('1712345678901_k3j9x2');
    expect(isByeTeamId(BYE_TEAM_ID)).toBe(true);
    expect(isByeTeamId(TEAM)).toBe(false);
  });
});
