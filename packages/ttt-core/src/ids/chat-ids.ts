/**
 * Frozen deterministic IDs for the chat realtime + notification redesign
 * (IMPLEMENTATION_MATRIX.md "Deterministic ID + eventId formulas").
 *
 * These ids are computed INDEPENDENTLY by multiple producers/consumers
 * (Cloud Functions, the chat Worker, sometimes the client) and MUST match
 * byte-for-byte, so the construction is frozen here as the single source of
 * truth. Hashing uses `@ttt-productions/edge-protocol-core`'s runtime-neutral
 * WebCrypto SHA-256 (works in Node 22, Cloudflare Workers, and browsers), so
 * every builder is async.
 */

import { sha256Hex } from '@ttt-productions/edge-protocol-core';

/** ASCII unit separator — never appears in uids/doc-ids/collection names/numbers. */
const UNIT_SEPARATOR = '\x1f';
/** A null/absent part hashes as this byte (distinct from any real value). */
const NULL_BYTE = '\x00';

function encodePart(part: string | number | null | undefined): string {
  if (part === null || part === undefined) return NULL_BYTE;
  return typeof part === 'number' ? String(part) : part;
}

/**
 * Canonical collision-safe hash — every `hash(...)` in the chat/notification
 * doc set uses THIS. `domainTag` then each part, separated by `0x1F`; numbers
 * base-10; a null/absent part becomes the literal byte `0x00`. The full 64-char
 * lowercase-hex SHA-256 is the document id. Two id families can never collide
 * because their `domainTag`s differ.
 */
export function hash(
  domainTag: string,
  ...parts: Array<string | number | null | undefined>
): Promise<string> {
  const input = domainTag + UNIT_SEPARATOR + parts.map(encodePart).join(UNIT_SEPARATOR);
  return sha256Hex(input);
}

// ── Channel identity ────────────────────────────────────────────────────────

/** A logical chat channel — a typed tuple, NEVER a Firestore path string. */
export type ChannelRef =
  | { scope: 'channel'; workProjectId: string; guildChatChannelId: string }
  | { scope: 'invite'; guildInviteId: string };

/** Per-scope collision-safe channel key. The raw tuple is stored alongside wherever this is a doc id. */
export function channelKey(ref: ChannelRef): Promise<string> {
  return ref.scope === 'channel'
    ? hash('chat-channel', ref.workProjectId, ref.guildChatChannelId)
    : hash('chat-invite', ref.guildInviteId);
}

/** Per-(channel, user) projection doc id (replaces the unsafe `{channelRef}__{uid}`). */
export async function authPairKey(ref: ChannelRef, uid: string): Promise<string> {
  return hash('chat-channel-auth', await channelKey(ref), uid);
}

/** Member-in-work degraded scope key (the `workChannelsForUser` selector blocks per uid×Work). */
export function userWorkScopeKey(uid: string, workProjectId: string): Promise<string> {
  return hash('chat-user-work', uid, workProjectId);
}

/** member-in-work degraded summary doc id. */
export function degradedMemberInWorkScopeKey(uid: string, workProjectId: string): Promise<string> {
  return hash('chat-degraded-user-work', uid, workProjectId);
}

/** Namespaced degraded cause id (`kind` keeps event-derived and job-derived causes from colliding). */
export function degradedCauseId(kind: 'syncEvent' | 'fanoutJob', ref: string): Promise<string> {
  return hash('chat-degraded-cause', kind, ref);
}

// ── chatSyncEvents eventIds ─────────────────────────────────────────────────

export function channelAuthEventId(channelKeyHash: string, uid: string, channelAuthVersion: number): Promise<string> {
  return hash('channel-auth', channelKeyHash, uid, channelAuthVersion);
}
export function accountAccessEventId(uid: string, accountAccessVersion: number, channelKeyHash: string): Promise<string> {
  return hash('account-access', uid, accountAccessVersion, channelKeyHash);
}
export function configEventId(channelKeyHash: string, configVersion: number): Promise<string> {
  return hash('config', channelKeyHash, configVersion);
}
export function attachmentFlipEventId(pendingMediaId: string, terminalState: string): Promise<string> {
  return hash('attachment-flip', pendingMediaId, terminalState);
}
export function serverMessageEventId(threadRef: string, sourceDocId: string): Promise<string> {
  return hash('server-msg', threadRef, sourceDocId);
}

/** `chatMessageOutbox` commandId for invite/system messages (= attachment uses the pendingMediaId directly). */
export function serverMessageCommandId(threadRef: string, sourceDocId: string): Promise<string> {
  return hash('server-msg', threadRef, sourceDocId);
}

// ── chatSyncFanoutJobs ──────────────────────────────────────────────────────

export type SyncFanoutSelectorKind = 'channelMembers' | 'workChannelsForUser' | 'policyEditAffectedUsers';

/**
 * `scopeKey` = `channelKey` for channelMembers/policyEditAffectedUsers, or
 * `userWorkScopeKey(uid, workProjectId)` for workChannelsForUser. `causeVersion`
 * = the channel's post-mutation configVersion, or the user's post-mutation
 * guildAuthInputVersion respectively.
 */
export function chatSyncFanoutJobId(
  selectorKind: SyncFanoutSelectorKind,
  scopeKey: string,
  causeVersion: number,
): Promise<string> {
  return hash('chat-sync-fanout', selectorKind, scopeKey, causeVersion);
}

// ── Inbox projection eventId ────────────────────────────────────────────────

export function inboxProjectionEventId(
  channelKeyHash: string,
  recipientUid: string,
  kind: string,
  sourceVersion: number,
): Promise<string> {
  return hash('chat-inbox-event', channelKeyHash, recipientUid, kind, sourceVersion);
}

// ── Notification ledger / archive ───────────────────────────────────────────

/** Delivery-ledger row id. Shared-admin occurrences pass `recipientUid = null` (hashed as `'shared'`). */
export function notificationDeliveryId(
  recipientUid: string | null,
  notificationType: string,
  eventId: string,
): Promise<string> {
  return hash('notif-delivery', recipientUid ?? 'shared', notificationType, eventId);
}

/** Type-scoped active-card id. `audienceScope` = `user:{uid}` (personal) or `shared` (shared-admin). */
export function activeNotificationDocId(
  notificationType: string,
  audienceScope: string,
  aggregationKey: string,
): Promise<string> {
  return hash('notif-active', notificationType, audienceScope, aggregationKey);
}

/** Archive history doc id (= `archiveOccurrenceId`). */
export function notificationArchiveHistoryId(
  category: string,
  audienceScope: string,
  requestId: string,
): Promise<string> {
  return hash('notification-archive', category, audienceScope, requestId);
}

/** Archive replay-vs-conflict discriminator. */
export function notificationArchivePayloadHash(
  activeId: string,
  observedActivityGeneration: string,
  category: string,
  audienceScope: string,
): Promise<string> {
  return hash('notification-archive-payload', activeId, observedActivityGeneration, category, audienceScope);
}

// ── Moderation audit ids (append-only; create-if-absent) ────────────────────

export function moderationRequestedAuditId(requestId: string): Promise<string> {
  return hash('chat-moderation-requested', requestId);
}
export function moderationAppliedAuditId(requestId: string, resultingMessageRevision: number): Promise<string> {
  return hash('chat-moderation-applied', requestId, resultingMessageRevision);
}
export function moderationFailedAuditId(requestId: string, terminalFailureGeneration: number): Promise<string> {
  return hash('chat-moderation-failed', requestId, terminalFailureGeneration);
}

// ── History anonymization ───────────────────────────────────────────────────

export function chatAnonymizeJobId(channelDoId: string, epoch: number, anonymizedUid: string): Promise<string> {
  return hash('chat-anonymize', channelDoId, epoch, anonymizedUid);
}
