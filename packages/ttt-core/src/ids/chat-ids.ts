// Functions, the chat Worker, and the client each compute these ids, so every formula must stay
// byte-for-byte identical.

import { sha256Hex } from '@ttt-productions/edge-protocol-core';
import type { ChatConversationRef } from '@ttt-productions/chat-schemas';

// Never appears in a uid, document id, collection name, or number.
const UNIT_SEPARATOR = '\x1f';
const NULL_BYTE = '\x00';

function encodePart(part: string | number | null | undefined): string {
  if (part === null || part === undefined) return NULL_BYTE;
  return typeof part === 'number' ? String(part) : part;
}

export function hash(
  domainTag: string,
  ...parts: Array<string | number | null | undefined>
): Promise<string> {
  const input = domainTag + UNIT_SEPARATOR + parts.map(encodePart).join(UNIT_SEPARATOR);
  return sha256Hex(input);
}

export function channelKey(ref: ChatConversationRef): Promise<string> {
  return hash('chat-conversation', ref.kind, ref.id);
}

export async function authPairKey(ref: ChatConversationRef, uid: string): Promise<string> {
  return hash('chat-channel-auth', await channelKey(ref), uid);
}

export function userWorkScopeKey(uid: string, workProjectId: string): Promise<string> {
  return hash('chat-user-work', uid, workProjectId);
}

export function degradedMemberInWorkScopeKey(uid: string, workProjectId: string): Promise<string> {
  return hash('chat-degraded-user-work', uid, workProjectId);
}

export function degradedCauseId(kind: 'syncEvent' | 'fanoutJob', ref: string): Promise<string> {
  return hash('chat-degraded-cause', kind, ref);
}

export function channelAuthEventId(
  channelKeyHash: string,
  uid: string,
  channelAuthVersion: number,
): Promise<string> {
  return hash('channel-auth', channelKeyHash, uid, channelAuthVersion);
}
export function accountAccessEventId(
  uid: string,
  accountAccessVersion: number,
  channelKeyHash: string,
): Promise<string> {
  return hash('account-access', uid, accountAccessVersion, channelKeyHash);
}
export function configEventId(channelKeyHash: string, configVersion: number): Promise<string> {
  return hash('config', channelKeyHash, configVersion);
}

export function serverMessageCommandId(threadRef: string, sourceDocId: string): Promise<string> {
  return hash('server-msg', threadRef, sourceDocId);
}

export type SyncFanoutSelectorKind =
  'channelMembers' | 'workChannelsForUser' | 'policyEditAffectedUsers';

export function chatSyncFanoutJobId(
  selectorKind: SyncFanoutSelectorKind,
  scopeKey: string,
  causeVersion: number,
): Promise<string> {
  return hash('chat-sync-fanout', selectorKind, scopeKey, causeVersion);
}

export function inboxProjectionEventId(
  channelKeyHash: string,
  recipientUid: string,
  kind: string,
  sourceVersion: number,
): Promise<string> {
  return hash('chat-inbox-event', channelKeyHash, recipientUid, kind, sourceVersion);
}

export function notificationDeliveryId(
  recipientUid: string | null,
  notificationType: string,
  eventId: string,
): Promise<string> {
  return hash('notif-delivery', recipientUid ?? 'shared', notificationType, eventId);
}

export function notificationArchiveHistoryId(
  category: string,
  audienceScope: string,
  requestId: string,
  activeId: string,
): Promise<string> {
  return hash('notification-archive', category, audienceScope, `${requestId}:${activeId}`);
}

export function notificationArchivePayloadHash(
  activeId: string,
  observedActivityGeneration: string,
  category: string,
  audienceScope: string,
): Promise<string> {
  return hash(
    'notification-archive-payload',
    activeId,
    observedActivityGeneration,
    category,
    audienceScope,
  );
}

export function moderationRequestedAuditId(requestId: string): Promise<string> {
  return hash('chat-moderation-requested', requestId);
}
export function moderationAppliedAuditId(
  requestId: string,
  resultingMessageRevision: number,
): Promise<string> {
  return hash('chat-moderation-applied', requestId, resultingMessageRevision);
}
export function moderationFailedAuditId(
  requestId: string,
  terminalFailureGeneration: number,
): Promise<string> {
  return hash('chat-moderation-failed', requestId, terminalFailureGeneration);
}

export function chatParkedDeliveryId(
  targetDo: string,
  eventId: string,
  parkedAt: number,
): Promise<string> {
  return hash('chat-parked-delivery', targetDo, eventId, parkedAt);
}

export function chatAnonymizeJobId(
  channelDoId: string,
  epoch: number,
  anonymizedUid: string,
): Promise<string> {
  return hash('chat-anonymize', channelDoId, epoch, anonymizedUid);
}

export function chatAnonTombstoneUid(anonymizedUid: string): Promise<string> {
  return hash('chat-anon-tombstone', anonymizedUid);
}
