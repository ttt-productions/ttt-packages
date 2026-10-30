import { CLOSED_LEAGUE_STATUS } from '../types/unions.js';
import type { LeagueStatus } from '../types/unions.js';

export function leagueTakesNewMembers(status: LeagueStatus): boolean {
  return status !== CLOSED_LEAGUE_STATUS;
}
