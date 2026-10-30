import { TEAM_TYPED_LEAGUE_MODE, type LeagueMode } from '../types/unions.js';

export function leagueModeSortsTeamsByType(mode: LeagueMode): boolean {
  return mode === TEAM_TYPED_LEAGUE_MODE;
}
