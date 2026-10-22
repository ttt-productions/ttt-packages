// No part contains its id's separator, so each parser decodes one way.

import type { FollowableTargetType } from '../schemas/social.js';
import type { NotificationType } from '../schemas/notification.js';
import {
  SafetySlaMonitorKindSchema,
  type SafetySlaMonitorKind,
} from '../doc-schemas/safety/monitors.js';
import type { AccountActionSource } from '../doc-schemas/safety/sagas.js';
import type { ConversationFileRef } from '../media/conversation-file-ref.js';

const DOUBLE_UNDERSCORE = '__';

export function followEdgeDocId(
  followerUid: string,
  targetType: FollowableTargetType,
  targetId: string,
): string {
  return [followerUid, targetType, targetId].join(DOUBLE_UNDERSCORE);
}

export function followCounterDocId(targetType: FollowableTargetType, targetId: string): string {
  return [targetType, targetId].join(DOUBLE_UNDERSCORE);
}

export function taggedCraftSkillDocId(craftSkillId: string, ownerUid: string): string {
  return `${craftSkillId}-${ownerUid}`;
}

export function thresholdItemDocId(workProjectId: string, itemId: string): string {
  return `${workProjectId}_${itemId}`;
}

export interface ThresholdItemDocIdParts {
  readonly workProjectId: string;
  readonly itemId: string;
}

export function parseThresholdItemDocId(docId: string): ThresholdItemDocIdParts | null {
  const parts = docId.split('_');
  if (parts.length !== 2) return null;
  const [workProjectId, itemId] = parts;
  if (!workProjectId || !itemId) return null;
  return { workProjectId, itemId };
}

export function thresholdSubmissionEventId(thresholdItemId: string, submittedAt: number): string {
  return `${thresholdItemId}:${submittedAt}`;
}

export function adminTaskForItemDocId(taskType: string, itemId: string): string {
  return `${taskType}-${itemId}`;
}

export function parseAdminTaskForItemDocId(taskType: string, docId: string): string | null {
  const prefix = `${taskType}-`;
  if (!docId.startsWith(prefix)) return null;
  const itemId = docId.slice(prefix.length);
  return itemId ? itemId : null;
}

export function contentAppealAdminTaskDocId(violationId: string): string {
  return `appeal-${violationId}`;
}

export function notificationFanoutJobDocId(
  eventId: string,
  notificationType: NotificationType,
): string {
  return `${eventId}:${notificationType}`;
}

export function adminDispatchReplyEventId(
  adminDispatchId: string,
  messageId: string,
  recipientUid?: string,
): string {
  const parts =
    recipientUid === undefined
      ? [adminDispatchId, messageId]
      : [adminDispatchId, messageId, recipientUid];
  return parts.join(':');
}

export function reportGroupOccurrenceEventId(groupId: string, totalReports: number): string {
  return `${groupId}:${totalReports}`;
}

export function auditionEntryMediaOwnerId(auditionId: string, auditionEntryId: string): string {
  return `${auditionId}:${auditionEntryId}`;
}

export function commissionProposalMediaOwnerId(
  commissionListingId: string,
  commissionProposalId: string,
): string {
  return `${commissionListingId}:${commissionProposalId}`;
}

export function conversationFileMediaOwnerId(
  conversation: ConversationFileRef,
  conversationFileId: string,
): string {
  const conversationId =
    conversation.kind === 'guildInvite' ? conversation.guildInviteId : conversation.adminDispatchId;
  return `${conversationId}:${conversationFileId}`;
}

export interface SafetyHoldRefDocIdParts {
  readonly caseId: string;
  readonly resourceKeyHash: string;
}

export function safetyHoldRefDocId(caseId: string, resourceKeyHash: string): string {
  return [caseId, resourceKeyHash].join(DOUBLE_UNDERSCORE);
}

export function parseSafetyHoldRefDocId(docId: string): SafetyHoldRefDocIdParts | null {
  const parts = docId.split(DOUBLE_UNDERSCORE);
  if (parts.length !== 2) return null;
  const [caseId, resourceKeyHash] = parts;
  if (!caseId || !resourceKeyHash) return null;
  return { caseId, resourceKeyHash };
}

export interface AccountActionCommandDocIdParts {
  readonly caseId: string;
  readonly targetUid: string;
  readonly source: AccountActionSource;
}

const OPERATOR_COMMAND_SUFFIX = 'operator';

export function accountActionCommandDocId(
  caseId: string,
  targetUid: string,
  source: AccountActionSource,
): string {
  const parts =
    source === 'operator' ? [caseId, targetUid, OPERATOR_COMMAND_SUFFIX] : [caseId, targetUid];
  return parts.join(DOUBLE_UNDERSCORE);
}

export function parseAccountActionCommandDocId(
  docId: string,
): AccountActionCommandDocIdParts | null {
  const parts = docId.split(DOUBLE_UNDERSCORE);
  const [caseId, targetUid, suffix] = parts;
  if (!caseId || !targetUid) return null;
  if (parts.length === 2) return { caseId, targetUid, source: 'autoHash' };
  if (parts.length === 3 && suffix === OPERATOR_COMMAND_SUFFIX) {
    return { caseId, targetUid, source: 'operator' };
  }
  return null;
}

export function safetySlaMonitorDocId(scopeId: string, monitorKind: SafetySlaMonitorKind): string {
  return [scopeId, monitorKind].join(DOUBLE_UNDERSCORE);
}

export interface SafetySlaMonitorDocIdParts {
  readonly scopeId: string;
  readonly monitorKind: SafetySlaMonitorKind;
}

export function parseSafetySlaMonitorDocId(docId: string): SafetySlaMonitorDocIdParts | null {
  const parts = docId.split(DOUBLE_UNDERSCORE);
  if (parts.length !== 2) return null;
  const [scopeId, kindText] = parts;
  const kind = SafetySlaMonitorKindSchema.safeParse(kindText);
  if (!scopeId || !kind.success) return null;
  return { scopeId, monitorKind: kind.data };
}

export function ncmecSubmissionJobDocId(caseId: string, submissionId: string): string {
  return [caseId, submissionId].join(DOUBLE_UNDERSCORE);
}

export interface NcmecSubmissionJobDocIdParts {
  readonly caseId: string;
  readonly submissionId: string;
}

export function parseNcmecSubmissionJobDocId(docId: string): NcmecSubmissionJobDocIdParts | null {
  const parts = docId.split(DOUBLE_UNDERSCORE);
  if (parts.length !== 2) return null;
  const [caseId, submissionId] = parts;
  if (!caseId || !submissionId) return null;
  return { caseId, submissionId };
}

export const CASE_LIFECYCLE_TRANSITIONS = ['closure', 'reopen'] as const;
export type CaseLifecycleTransition = (typeof CASE_LIFECYCLE_TRANSITIONS)[number];

export function nciiCaseClosureEventDocId(
  transition: CaseLifecycleTransition,
  revision: number,
): string {
  return `${transition}-r${revision}`;
}

export function childSafetyLifecycleDecisionDocId(
  transition: CaseLifecycleTransition,
  caseId: string,
  revision: number,
): string {
  return `${transition}-${caseId}-r${revision}`;
}

export function childSafetyReportDispositionDecisionDocId(at: number): string {
  return `${at}_reportDisposition`;
}

export type ChildSafetyDecisionIdParts =
  | {
      readonly kind: 'lifecycle';
      readonly transition: CaseLifecycleTransition;
      readonly revision: number;
    }
  | { readonly kind: 'reportDisposition'; readonly at: number };

export function childSafetyDecisionDocId(
  caseId: string,
  decision: ChildSafetyDecisionIdParts,
): string {
  return decision.kind === 'lifecycle'
    ? childSafetyLifecycleDecisionDocId(decision.transition, caseId, decision.revision)
    : childSafetyReportDispositionDecisionDocId(decision.at);
}

const ACCOUNT_HISTORY_SUFFIX_BY_SOURCE = {
  autoHash: 'autoHash',
  operator: 'op',
} as const satisfies Record<AccountActionSource, string>;

export function childSafetyCaseAccountHistoryDocId(
  at: number,
  source: AccountActionSource,
): string {
  return `${at}_${ACCOUNT_HISTORY_SUFFIX_BY_SOURCE[source]}`;
}
