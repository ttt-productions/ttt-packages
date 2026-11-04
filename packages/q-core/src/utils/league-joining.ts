import { CLOSED_LEAGUE_STATUS } from '../types/unions.js';
import type { LeagueStatus } from '../types/unions.js';

export function leagueTakesNewMembers(status: LeagueStatus): boolean {
  return status !== CLOSED_LEAGUE_STATUS;
}

export const LEAGUE_WAIVER_REQUIREMENT_LOCKED_MESSAGE =
  'This league already has players, so its waiver can no longer be turned on or off.';

// Once anyone is on a team in the league, every real person on a team got there through a path that
// checked the waiver; turning the requirement on or off would break that.
export function leagueWaiverRequirementChangeable(leagueHasMembers: boolean): boolean {
  return !leagueHasMembers;
}
