import { resourceKeyHash } from './resource-keys.js';
import type {
  TakeItDownFieldCode,
  TakeItDownRequesterRole,
  TargetLocatorV1,
  TargetLocatorSummaryV1,
} from '../doc-schemas/safety/foundation.js';

export const sha256Hex = resourceKeyHash;

// Cannot appear in any joined id, url, or field.
const SEP = '\x1f';

// Bumping it re-keys every request doc id.
const REQUEST_ID_VERSION = 'takeItDownRequest:v1';

export function tempHoldId(requestId: string): string {
  return sha256Hex(`nciiTemporaryHold:v1:${requestId}`);
}

export function firstSubmissionId(requestId: string): string {
  return sha256Hex(`takeItDownSubmission:v1:${requestId}:0`);
}

export function intakeActionId(requestId: string): string {
  return sha256Hex(`takeItDownAction:v1:intakeReceived:${requestId}`);
}

export function normalizedTargetKey(locator: TargetLocatorV1): string {
  const k = locator.kind;
  switch (locator.kind) {
    case 'mediaAsset':
      return [k, locator.mediaAssetId].join(SEP);
    case 'hallItem':
      return [k, locator.hallItemId, locator.subItemId ?? ''].join(SEP);
    case 'squarePost':
      return [k, locator.postId].join(SEP);
    case 'profileImage':
      return [k, locator.profileUid].join(SEP);
    case 'username':
      return [k, locator.profileUid].join(SEP);
    case 'craftSkill':
      return [k, locator.profileUid, locator.craftSkillId].join(SEP);
    case 'commissionListing':
      return [k, locator.commissionListingId].join(SEP);
    case 'audition':
      return [k, locator.auditionId].join(SEP);
    case 'auditionEntry':
      return [k, locator.auditionId, locator.auditionEntryId].join(SEP);
    case 'guildInviteMessage':
      return [k, locator.channelId, locator.messageId].join(SEP);
    case 'conversationFile':
      return [
        k,
        locator.conversation.kind,
        locator.conversation.kind === 'guildInvite'
          ? locator.conversation.guildInviteId
          : locator.conversation.adminDispatchId,
        locator.conversationFileId,
        locator.mediaAssetId,
      ].join(SEP);
    case 'guildChatMessage':
      return [k, locator.channelId, locator.messageId].join(SEP);
    case 'commissionProposal':
      return [k, locator.commissionListingId, locator.commissionProposalId].join(SEP);
    case 'workProject':
      return [k, locator.workProjectId].join(SEP);
    case 'workAsset':
      return [k, locator.workProjectId, locator.workAssetId].join(SEP);
    case 'workRealm':
      return [k, locator.workRealmId].join(SEP);
    case 'url':
      return [k, normalizeExternalUrl(locator.url)].join(SEP);
    case 'additionalText':
      return [k, locator.textRef].join(SEP);
  }
}

export function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

export function deterministicRequestId(idempotencyKey: string, targetKey: string): string {
  return sha256Hex(`${REQUEST_ID_VERSION}:${idempotencyKey}:${targetKey}`);
}

export function deriveRequestReference(requestId: string): string {
  return sha256Hex(`takeItDownRequestRef:v1:${requestId}`).slice(0, 32);
}

export function cumulativeSnapshotHash(args: {
  requesterRole: TakeItDownRequesterRole;
  targetKey: string;
  suppliedFieldCodes: readonly TakeItDownFieldCode[];
}): string {
  const sorted = [...args.suppliedFieldCodes].sort();
  return sha256Hex(
    ['takeItDownSnapshot:v1', args.requesterRole, args.targetKey, sorted.join(',')].join(SEP),
  );
}

export function surfaceLabelFor(locator: TargetLocatorV1): string {
  switch (locator.kind) {
    case 'mediaAsset':
      return 'Media item';
    case 'hallItem':
      return 'Hall library item';
    case 'squarePost':
      return 'Square Streetz post';
    case 'profileImage':
      return 'Profile image';
    case 'username':
      return 'Username';
    case 'craftSkill':
      return 'Craft skill';
    case 'commissionListing':
      return 'Commission listing';
    case 'audition':
      return 'Audition';
    case 'auditionEntry':
      return 'Audition entry';
    case 'guildInviteMessage':
      return 'Guild invite message';
    case 'conversationFile':
      return 'Conversation file';
    case 'guildChatMessage':
      return 'Guild chat message';
    case 'commissionProposal':
      return 'Commission proposal';
    case 'workProject':
      return 'Work project';
    case 'workAsset':
      return 'Work file';
    case 'workRealm':
      return 'Work realm';
    case 'url':
      return 'External link';
    case 'additionalText':
      return 'Described content';
  }
}

export function targetLocatorSummary(
  locator: TargetLocatorV1,
  hasResolvedTarget: boolean,
): TargetLocatorSummaryV1 {
  return {
    kind: locator.kind,
    surfaceLabel: surfaceLabelFor(locator),
    hasResolvedTarget,
  };
}

const TTT_HOSTED_KINDS: ReadonlySet<TargetLocatorV1['kind']> = new Set([
  'mediaAsset',
  'hallItem',
  'squarePost',
  'profileImage',
  'username',
  'craftSkill',
  'commissionListing',
  'audition',
  'auditionEntry',
  'guildInviteMessage',
  'conversationFile',
]);

export function isTttHostedLocator(locator: TargetLocatorV1): boolean {
  return TTT_HOSTED_KINDS.has(locator.kind);
}
