// Moderation Firestore document SCHEMAS — contentViolations/{id}, the content-appeal
// admin task, and the moderationCascadeManifests/{id} (+ changedDocs) records.
// Types inferred via z.infer.

import { z } from 'zod';
import { PendingMediaProcessingSchema } from '../media/pending-media.js';
import { AdminTaskSchema } from './report-docs.js';
import { ReportableItemTypeSchema } from './safety/foundation.js';
import { MediaAssetOwnerTypeSchema } from './media-assets.js';
import { isRejectedMediaAppealOpen } from '../constants/retention.js';

/**
 * Which hide a hidden document carries: `direct` when the document itself is the target of a
 * hide, `cascade` when a hide of its parent reached it. A parent's restore leaves a `direct`
 * document hidden (BACKEND-206). Absent when the document is not hidden.
 */
export const ModerationHiddenBySchema = z.enum(['direct', 'cascade']);
export type ModerationHiddenBy = z.infer<typeof ModerationHiddenBySchema>;

/**
 * A target's moderation decision number. Every hide or restore of one target takes the next
 * number (1, 2, …); every edge step, cleanup, and replay compares the number it carries with the
 * target's latest, and a stale step re-applies the latest decision instead of its own.
 */
export const ModerationDecisionNumberSchema = z.number().int().positive();
export type ModerationDecisionNumber = z.infer<typeof ModerationDecisionNumberSchema>;

/** The durable edge-serving obligation opened by a moderation hide or restore. */
export const ModerationEdgeSyncOpSchema = z.enum(['block', 'blockClear']);
export type ModerationEdgeSyncOp = z.infer<typeof ModerationEdgeSyncOpSchema>;

/** An unsettled moderation edge-serving obligation; null records a settled one. */
export const ModerationEdgeSyncStateSchema = z.enum(['processing', 'failed']);
export type ModerationEdgeSyncState = z.infer<typeof ModerationEdgeSyncStateSchema>;

export const ContentViolationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  fileType: z.string(),
  violationType: z.enum(['text', 'media']).optional(),
  reason: z.string(),
  timestamp: z.number(),
  appealStatus: z.enum(['none', 'pending', 'approved', 'denied']),
  // Text violations (moderateTextOrThrow / media-result-handler 'text_rejected') write these and
  // omit the media-only fields below; media violations (logContentViolation) do the reverse.
  flaggedWords: z.array(z.string()).optional(),
  originalText: z.string().optional(),
  // Media-only fields. Optional because text violations omit them, and `scores` is nullable
  // because moderateTextOrThrow writes `scores: result.scores ?? null`.
  originalFileName: z.string().optional(),
  scores: z.object({
    adult: z.string(),
    violence: z.string(),
    racy: z.string(),
  }).nullable().optional(),
  // Internal GCS path of the preserved rejected file — never a serving contract.
  // Appeal viewing is owner/admin-gated (rules-gated SDK read or signed URL).
  rejectedFilePath: z.string().optional(),
  // The pendingMedia row AS CLAIMED by the processor: logContentViolation snapshots the in-memory
  // claimed row before the row is finalized `rejected`, so the stored status is `processing` —
  // never `pending` and never `rejected`. An approved appeal re-queues a FRESH `pending` row built
  // from these fields; it does not reuse this snapshot as a document.
  pendingFile: PendingMediaProcessingSchema.partial().optional(),
  // Appeal lifecycle (submitContentAppeal / reviewContentAppeal).
  appealMessage: z.string().optional(),
  appealedAt: z.number().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.number().optional(),
  reviewDecision: z.enum(['approved', 'denied']).optional(),
  reviewNotes: z.string().optional(),
});
export type ContentViolation = z.infer<typeof ContentViolationSchema>;

/** What the member may do with a violation: appeal it, and accept the decision. */
export interface ContentViolationActions {
  readonly appeal: boolean;
  readonly accept: boolean;
}

/**
 * The ONE rule for the actions a violation offers, by its appeal status. `none`: Appeal — a
 * media violation only, inside the appeal window measured from the rejection (`timestamp`) — and
 * Accept. `pending`: nothing (the appeal is locked until reviewed). `denied`: Accept only.
 * `approved`: nothing (the approval re-publishes the upload). The server enforces the same rule
 * in the transaction that acts.
 */
export function contentViolationActions(
  violation: Pick<ContentViolation, 'appealStatus' | 'violationType' | 'timestamp'>,
  now: number,
): ContentViolationActions {
  switch (violation.appealStatus) {
    case 'none':
      return {
        appeal: violation.violationType === 'media' && isRejectedMediaAppealOpen(violation.timestamp, now),
        accept: true,
      };
    case 'denied':
      return { appeal: false, accept: true };
    case 'pending':
    case 'approved':
      return { appeal: false, accept: false };
  }
}

// content-appeal admin task: the generic AdminTask specialized to 'content-appeal' plus
// the appeal-specific denormalized fields used by the admin review view.
export const ContentAppealTaskSchema = AdminTaskSchema.extend({
  taskType: z.literal('content-appeal'),
  violationId: z.string(),
  userId: z.string(),
  fileType: z.string(),
  rejectionReason: z.string(),
  appealMessage: z.string(),
  rejectedFilePath: z.string(),
});
export type ContentAppealTask = z.infer<typeof ContentAppealTaskSchema>;

/** A manifest either hides its target (and whatever the hide reaches) or restores it. */
export const ModerationCascadeActionSchema = z.enum(['hide', 'restore']);
export type ModerationCascadeAction = z.infer<typeof ModerationCascadeActionSchema>;

export const ModerationCascadeStatusSchema = z.enum(['pending', 'complete', 'failed']);
export type ModerationCascadeStatus = z.infer<typeof ModerationCascadeStatusSchema>;

/**
 * The kinds of document a manifest records a change on. A `mediaAsset` record marks an asset
 * whose serving the manifest denied — its `previousValue`/`newValue` are that marker, never the
 * string `servingStatus`; every other kind records a boolean hidden-family field flip.
 */
export const ModerationCascadeChangedEntityTypeSchema = z.enum([
  'workProject',
  'hallItem',
  'subItemProjection',
  'workRealm',
  'mediaAsset',
  'squareStreetzPost',
  'audition',
  'auditionEntry',
  'commissionListing',
  'commissionProposal',
  'craftSkill',
  'craftSkillReference',
]);
export type ModerationCascadeChangedEntityType = z.infer<typeof ModerationCascadeChangedEntityTypeSchema>;

/**
 * Every report and Admin Tool hide target, in the report vocabulary. A `username` report is
 * remedied by a rename and the two chat-message kinds by the chat tombstone lane — none of the
 * three is ever hidden, so none has a manifest.
 */
export const ModerationCascadeManifestEntityTypeSchema = ReportableItemTypeSchema.extract([
  'square-streetz-post',
  'audition',
  'audition-entry',
  'commission-listing',
  'commission-proposal',
  'craft-skill',
  'profile-picture',
  'work-asset',
  'conversation-file',
  'hall-library-item',
  'hall-library-sub-item',
  'work-project',
  'work-realm',
]);
export type ModerationCascadeManifestEntityType = z.infer<typeof ModerationCascadeManifestEntityTypeSchema>;
export const MODERATION_HIDE_TARGET_TYPES = ModerationCascadeManifestEntityTypeSchema.options;

/**
 * The hide targets whose id is unique only under a parent: an entry under its audition, a proposal
 * under its listing, a Hall sub-item under its Hall item, a craft skill under its owner. Every other
 * target's id is unique alone and never carries a parent — so one target has exactly one key.
 */
export const MODERATION_PARENT_KEYED_TARGET_TYPES = [
  'audition-entry',
  'commission-proposal',
  'hall-library-sub-item',
  'craft-skill',
] as const satisfies readonly ModerationCascadeManifestEntityType[];

/** Whether a hide target's id is unique only under its parent. */
export function isModerationParentKeyedTargetType(entityType: ModerationCascadeManifestEntityType): boolean {
  return (MODERATION_PARENT_KEYED_TARGET_TYPES as readonly string[]).includes(entityType);
}

/** One hide target: its type, its id, and — exactly for a parent-keyed type — that parent. */
export interface ModerationTarget {
  readonly entityType: ModerationCascadeManifestEntityType;
  readonly entityId: string;
  readonly parentEntityId?: string;
}

/** A part prefixed by its length, so parts that contain any character still decode one way. */
const lengthPrefixed = (part: string): string => `${part.length}:${part}`;

/**
 * The key every manifest of one target shares: the type, the parent (empty for a target keyed by
 * its id alone), and the id, each length-prefixed so no two targets share a key whatever their ids
 * contain. Throws for a parent-keyed type without a parent and for any other type with one.
 */
export function moderationTargetKey(target: ModerationTarget): string {
  const parentKeyed = isModerationParentKeyedTargetType(target.entityType);
  if (parentKeyed && !target.parentEntityId) {
    throw new Error(`A ${target.entityType} target is keyed under its parent; parentEntityId is required.`);
  }
  if (!parentKeyed && target.parentEntityId !== undefined) {
    throw new Error(`A ${target.entityType} target is keyed by its id alone; it carries no parentEntityId.`);
  }
  return [target.entityType, target.parentEntityId ?? '', target.entityId].map(lengthPrefixed).join('');
}

/**
 * The manifest doc id of one decision on one target. Deterministic, so two decisions racing for
 * the same number write the same doc and conflict instead of both committing. The target key is
 * length-prefixed throughout, so the decision after the last `~` decodes one way.
 */
export function moderationCascadeManifestId(targetKey: string, decision: ModerationDecisionNumber): string {
  return `${targetKey}~${decision}`;
}

/**
 * `moderationCascadeManifests/{cascadeId}` — one hide or restore decision on one target, carried
 * out page by page. A hide records every document it changes in `changedDocs` before the change
 * lands, so its restore reverses exactly those; a restore is its own manifest with the next
 * decision number. `status` stays `pending` until every page and edge step is done; the retry
 * ledger lets a manifest that keeps failing back off instead of holding the resume's window.
 */
export const ModerationCascadeManifestSchema = z.object({
  cascadeId: z.string(),
  action: ModerationCascadeActionSchema,
  entityType: ModerationCascadeManifestEntityTypeSchema,
  entityId: z.string(),
  parentEntityId: z.string().min(1).optional(),
  targetKey: z.string().min(1),
  decision: ModerationDecisionNumberSchema,
  actorUid: z.string(),
  reason: z.string(),
  createdAt: z.number(),
  completedAt: z.number().optional(),
  status: ModerationCascadeStatusSchema,
  attemptCount: z.number().int().nonnegative().optional(),
  nextAttemptAt: z.number().optional(),
  lastError: z.string().optional(),
}).superRefine((manifest, ctx) => {
  // The key and the id are derived fields: a manifest whose stored key or id disagrees with its
  // target and decision would sit outside the target's decision sequence.
  let targetKey: string;
  try {
    targetKey = moderationTargetKey(manifest);
  } catch (error) {
    ctx.addIssue({ code: 'custom', path: ['parentEntityId'], message: (error as Error).message });
    return;
  }
  if (manifest.targetKey !== targetKey) {
    ctx.addIssue({ code: 'custom', path: ['targetKey'], message: 'targetKey must be moderationTargetKey of the target.' });
  }
  if (manifest.cascadeId !== moderationCascadeManifestId(targetKey, manifest.decision)) {
    ctx.addIssue({
      code: 'custom',
      path: ['cascadeId'],
      message: 'cascadeId must be moderationCascadeManifestId of the target key and decision.',
    });
  }
});
export type ModerationCascadeManifest = z.infer<typeof ModerationCascadeManifestSchema>;

export const ModerationCascadeChangedDocSchema = z.object({
  docPath: z.string(),
  entityType: ModerationCascadeChangedEntityTypeSchema,
  fieldPath: z.string(),
  previousValue: z.boolean(),
  newValue: z.boolean(),
  restored: z.boolean(),
  restoredAt: z.number().optional(),
  // A direct hide landed after this cascade hid the doc, so cascade restore
  // correctly leaves the later independent moderation action intact.
  restoreSkipped: z.literal('directHidden').optional(),
  // The edge block this record's hide wrote (an owner key, e.g. an audition entry's
  // `auditionEntry` / `{auditionId}:{entryId}`) and the assets whose serving it denied, so the
  // restore clears exactly what the hide closed.
  edgeSyncOwnerType: MediaAssetOwnerTypeSchema.optional(),
  edgeSyncOwnerId: z.string().min(1).optional(),
  edgeSyncAssetIds: z.array(z.string().min(1)).optional(),
});
export type ModerationCascadeChangedDoc = z.infer<typeof ModerationCascadeChangedDocSchema>;
