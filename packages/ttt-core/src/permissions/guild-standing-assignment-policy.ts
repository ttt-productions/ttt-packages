import type { GuildStandingId } from './work-project-permissions.js';
import { isGuildStandingId } from './work-project-permissions.js';

export type GuildStandingAssignmentAction = 'add' | 'remove';

export const NON_ASSIGNABLE_GUILD_STANDINGS = ['StewardOwner'] as const satisfies readonly GuildStandingId[];
export const STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS = [
  'WorkProjectManager',
  'GuildStandingManager',
  'StakeShareManager',
] as const satisfies readonly GuildStandingId[];

const ownerOnlyAssignable = new Set<GuildStandingId>(STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS);

export interface CanAssignGuildStandingArgs {
  actorIsOwner: boolean;
  actorRoles: readonly string[];
  targetRole: string;
  action: GuildStandingAssignmentAction;
  actorUid?: string;
  targetUid?: string;
}

export interface CanAssignGuildStandingResult {
  allowed: boolean;
  reason?: string;
}

export function canAssignGuildStanding({
  actorIsOwner,
  actorRoles,
  targetRole,
  actorUid,
  targetUid,
}: CanAssignGuildStandingArgs): CanAssignGuildStandingResult {
  if (targetRole === 'StewardOwner') {
    return { allowed: false, reason: 'StewardOwner is not an assignable workProject guild standing.' };
  }

  if (!isGuildStandingId(targetRole)) {
    return { allowed: false, reason: `Unknown workProject guild standing: ${targetRole}` };
  }

  if (actorUid && targetUid && actorUid === targetUid && !actorIsOwner) {
    return { allowed: false, reason: 'Only the workProject stewardOwner can edit their own guild standings.' };
  }

  if (actorIsOwner) {
    return { allowed: true };
  }

  const normalizedActorRoles = actorRoles.filter(isGuildStandingId);
  const actorCanManageRoles =
    normalizedActorRoles.includes('WorkProjectManager') || normalizedActorRoles.includes('GuildStandingManager');

  if (!actorCanManageRoles) {
    return { allowed: false, reason: 'WorkProjectManager or GuildStandingManager standing is required.' };
  }

  if (ownerOnlyAssignable.has(targetRole)) {
    return { allowed: false, reason: `${targetRole} can only be assigned or removed by the workProject stewardOwner.` };
  }

  return { allowed: true };
}

