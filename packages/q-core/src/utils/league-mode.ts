// Whether a league sorts its teams by type. It is the one reading every surface makes — the team
// form's required type, the type control, the standings and rankings split into pools, the team list
// grouped by type, and the admin's mode copy — so no reader compares the mode on its own (RULE-STD-ENG-005).

import { TEAM_TYPED_LEAGUE_MODE, type LeagueMode } from '../types/unions.js';

/** Whether a league in `mode` sorts its teams by type, so each team carries a `teamType`. */
export function leagueModeSortsTeamsByType(mode: LeagueMode): boolean {
  return mode === TEAM_TYPED_LEAGUE_MODE;
}
