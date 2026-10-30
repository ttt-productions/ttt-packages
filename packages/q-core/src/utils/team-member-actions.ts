import type { CaptainTeamRole } from '../types/audit.js';
import {
  TEAM_CAPTAIN_ROLE,
  TEAM_CO_CAPTAIN_ROLE,
  TEAM_PLAYER_ROLE,
  type SystemRole,
  type TeamRole,
} from '../types/unions.js';

export const TEAM_MEMBER_ADMIN_ACTOR = 'admin' as const satisfies SystemRole;

export type TeamMemberActor = typeof TEAM_MEMBER_ADMIN_ACTOR | CaptainTeamRole;

export interface TeamMemberTarget {
  role: TeamRole;
  isGhost: boolean;
}

export interface TeamMemberActions {
  promote: boolean;
  demote: boolean;
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
