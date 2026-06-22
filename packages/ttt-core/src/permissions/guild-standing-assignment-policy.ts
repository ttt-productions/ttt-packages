import type { GuildStandingId } from './work-project-permissions.js';
import {
  getGuildStandingIdFromValue,
  isGuildStandingValue,
} from './work-project-permissions.js';

export type GuildStandingAssignmentAction = 'add' | 'remove';

export const NON_ASSIGNABLE_GUILD_STANDINGS = ['StewardOwner'] as const satisfies readonly GuildStandingId[];
export const STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS = [
  'WorkProjectManager',
  'GuildStandingManager',
  'StakeShareManager',
  'WorkAssetAdmin',
] as const satisfies readonly GuildStandingId[];

const ownerOnlyAssignable = new Set<GuildStandingId>(STEWARD_ONLY_ASSIGNABLE_GUILD_STANDINGS);

export interface CanAssignGuildStandingArgs {
  actorIsStewardOwner: boolean;
  actorGuildStandings: readonly string[];
  targetGuildStanding: string;
  action: GuildStandingAssignmentAction;
  actorUid?: string;
  targetUid?: string;
}

export interface CanAssignGuildStandingResult {
  allowed: boolean;
  reason?: string;
}

export function canAssignGuildStanding({
  actorIsStewardOwner,
  actorGuildStandings,
  targetGuildStanding,
  actorUid,
  targetUid,
}: CanAssignGuildStandingArgs): CanAssignGuildStandingResult {
  if (!isGuildStandingValue(targetGuildStanding)) {
    return { allowed: false, reason: `Unknown workProject guild standing: ${targetGuildStanding}` };
  }
  const targetGuildStandingId = getGuildStandingIdFromValue(targetGuildStanding);

  if (targetGuildStandingId === 'StewardOwner') {
    return { allowed: false, reason: 'Steward is not an assignable workProject guild standing.' };
  }

  if (actorUid && targetUid && actorUid === targetUid && !actorIsStewardOwner) {
    return { allowed: false, reason: 'Only the work steward can edit their own guild standings.' };
  }

  if (actorIsStewardOwner) {
    return { allowed: true };
  }

  const normalizedActorGuildStandingIds = actorGuildStandings
    .filter(isGuildStandingValue)
    .map(getGuildStandingIdFromValue);
  const actorCanManageGuildStandings =
    normalizedActorGuildStandingIds.includes('WorkProjectManager') ||
    normalizedActorGuildStandingIds.includes('GuildStandingManager');

  if (!actorCanManageGuildStandings) {
    return { allowed: false, reason: 'WorkProjectManager or GuildStandingManager standing is required.' };
  }

  if (ownerOnlyAssignable.has(targetGuildStandingId)) {
    return { allowed: false, reason: `${targetGuildStanding} can only be assigned or removed by the work steward.` };
  }

  return { allowed: true };
}

