import { describe, expect, it } from 'vitest';
import { LEAGUE_MODE_KEYS, TEAM_TYPED_LEAGUE_MODE } from '../src/types/unions.js';
import { leagueModeSortsTeamsByType } from '../src/utils/league-mode.js';

describe('whether a league sorts its teams by type', () => {
  it('is true for the team-typed mode alone', () => {
    expect(LEAGUE_MODE_KEYS.filter(leagueModeSortsTeamsByType)).toEqual([TEAM_TYPED_LEAGUE_MODE]);
  });
});
