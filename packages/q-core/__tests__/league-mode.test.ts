// A league sorts its teams by type in the one team-typed mode and in no other.

import { describe, expect, it } from 'vitest';
import { LEAGUE_MODE_KEYS, TEAM_TYPED_LEAGUE_MODE } from '../src/types/unions';
import { leagueModeSortsTeamsByType } from '../src/utils/league-mode';

describe('whether a league sorts its teams by type', () => {
  it('is true for the team-typed mode alone', () => {
    expect(LEAGUE_MODE_KEYS.filter(leagueModeSortsTeamsByType)).toEqual([TEAM_TYPED_LEAGUE_MODE]);
  });
});
