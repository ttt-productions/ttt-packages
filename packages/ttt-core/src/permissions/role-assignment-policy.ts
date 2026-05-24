import type { ProjectRoleId } from './project-permissions.js';
import { isProjectRoleId } from './project-permissions.js';

export type ProjectRoleAssignmentAction = 'add' | 'remove';

export const NON_ASSIGNABLE_PROJECT_ROLES = ['Owner'] as const;
export const OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES = [
  'ProjectManager',
  'RoleManager',
  'ShareManager',
] as const satisfies readonly ProjectRoleId[];

const ownerOnlyAssignable = new Set<ProjectRoleId>(OWNER_ONLY_ASSIGNABLE_PROJECT_ROLES);

export interface CanAssignProjectRoleArgs {
  actorIsOwner: boolean;
  actorRoles: readonly string[];
  targetRole: string;
  action: ProjectRoleAssignmentAction;
  actorUid?: string;
  targetUid?: string;
}

export interface CanAssignProjectRoleResult {
  allowed: boolean;
  reason?: string;
}

export function canAssignProjectRole({
  actorIsOwner,
  actorRoles,
  targetRole,
  actorUid,
  targetUid,
}: CanAssignProjectRoleArgs): CanAssignProjectRoleResult {
  if (targetRole === 'Owner') {
    return { allowed: false, reason: 'Owner is not an assignable project role.' };
  }

  if (!isProjectRoleId(targetRole)) {
    return { allowed: false, reason: `Unknown project role: ${targetRole}` };
  }

  if (actorUid && targetUid && actorUid === targetUid && !actorIsOwner) {
    return { allowed: false, reason: 'Only the project owner can edit their own roles.' };
  }

  if (actorIsOwner) {
    return { allowed: true };
  }

  const normalizedActorRoles = actorRoles.filter(isProjectRoleId);
  const actorCanManageRoles =
    normalizedActorRoles.includes('ProjectManager') || normalizedActorRoles.includes('RoleManager');

  if (!actorCanManageRoles) {
    return { allowed: false, reason: 'ProjectManager or RoleManager role is required.' };
  }

  if (ownerOnlyAssignable.has(targetRole)) {
    return { allowed: false, reason: `${targetRole} can only be assigned or removed by the project owner.` };
  }

  return { allowed: true };
}
