// Whether a league takes new members. A closed league's season is over and `closed` is final, so no
// door puts a person on one of its teams: sending or accepting an invitation, sending or accepting a
// join request, free-agent signup, and the admin's free-agent placement each refuse it, reading the
// league inside their transaction, and the UI does not offer them there (RULE-STD-FRONTEND-110). The one way
// onto a closed league's team is the admin's closed-league ghost link. An admin still creates teams
// and edits the schedule on a closed league, to repair a past season.

import { CLOSED_LEAGUE_STATUS } from '../types/unions.js';
import type { LeagueStatus } from '../types/unions.js';

/** Whether a league in `status` takes new members: every status but `closed`. */
export function leagueTakesNewMembers(status: LeagueStatus): boolean {
  return status !== CLOSED_LEAGUE_STATUS;
}
