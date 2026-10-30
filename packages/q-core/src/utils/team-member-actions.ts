// What a team leader or an admin may do to one member of a team: promote a player to co-captain,
// demote a co-captain to player, or remove them. The team's management callables refuse what this
// leaves out, and the team page and the admin Teams tab offer exactly what it allows (RULE-STD-FRONTEND-110):
//
// - the captain is never moved or removed here — an admin changes the team's captain first;
// - only the captain and an admin promote or demote, and a ghost is never made a co-captain, since no
//   one could act with that authority;
// - a co-captain removes plain players only — never another co-captain, never the captain.
//
// A ghost leaves through its own removal, which decides whether it has played; that is still a
// removal here.

import type { CaptainTeamRole } from '../types/audit.js';
import {
  TEAM_CAPTAIN_ROLE,
  TEAM_CO_CAPTAIN_ROLE,
  TEAM_PLAYER_ROLE,
  type SystemRole,
  type TeamRole,
} from '../types/unions.js';

/** An action on a member taken under the admin role, where no captaincy on the team admits the caller. */
export const TEAM_MEMBER_ADMIN_ACTOR = 'admin' as const satisfies SystemRole;

/** The authority an action on a member is taken under: an admin, or the caller's role on the team. */
export type TeamMemberActor = typeof TEAM_MEMBER_ADMIN_ACTOR | CaptainTeamRole;

/** The member acted on: their role on the team, and whether they are a ghost. */
export interface TeamMemberTarget {
  role: TeamRole;
  isGhost: boolean;
}

export interface TeamMemberActions {
  /** Make the player a co-captain. */
  promote: boolean;
  /** Make the co-captain a player. */
  demote: boolean;
  /** Take them off the team — a ghost through the ghost removal. */
  remove: boolean;
}

const NONE: TeamMemberActions = { promote: false, demote: false, remove: false };

export function teamMemberActions(
  actor: TeamMemberActor,
  target: TeamMemberTarget,
): TeamMemberActions {
  if (target.role === TEAM_CAPTAIN_ROLE) return NONE;
  const managesCoCaptains = actor === TEAM_MEMBER_ADMIN_ACTOR || actor === TEAM_CAPTAIN_ROLE;
  return {
    promote: managesCoCaptains && target.role === TEAM_PLAYER_ROLE && !target.isGhost,
    demote: managesCoCaptains && target.role === TEAM_CO_CAPTAIN_ROLE,
    remove: managesCoCaptains || target.role === TEAM_PLAYER_ROLE,
  };
}
