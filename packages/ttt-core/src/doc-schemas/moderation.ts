import { z } from 'zod';
import { PendingMediaProcessingSchema } from '../media/pending-media.js';
import { AdminTaskSchema } from './report-docs.js';
import { ReportableItemTypeSchema } from './safety/foundation.js';
import { ContentMediaKindSchema, MediaAssetOwnerTypeSchema } from './media-assets.js';
import { isRejectedMediaAppealOpen } from '../constants/retention.js';

export const ModerationHiddenBySchema = z.enum(['direct', 'cascade']);
export type ModerationHiddenBy = z.infer<typeof ModerationHiddenBySchema>;

export const ModerationDecisionNumberSchema = z.number().int().positive();
export type ModerationDecisionNumber = z.infer<typeof ModerationDecisionNumberSchema>;

export const ModerationEdgeSyncOpSchema = z.enum(['block', 'blockClear']);
export type ModerationEdgeSyncOp = z.infer<typeof ModerationEdgeSyncOpSchema>;

export const ModerationEdgeSyncStateSchema = z.enum(['processing', 'failed']);
export type ModerationEdgeSyncState = z.infer<typeof ModerationEdgeSyncStateSchema>;

export const ContentViolationSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    fileType: z.string(),
    violationType: z.enum(['text', 'media']).optional(),
    reason: z.string(),
    timestamp: z.number(),
    appealStatus: z.enum(['none', 'pending', 'approved', 'denied']),
    flaggedWords: z.array(z.string()).optional(),
    originalText: z.string().optional(),
    originalFileName: z.string().optional(),
    mediaKind: ContentMediaKindSchema.optional(),
    scores: z
      .object({
        adult: z.string(),
        violence: z.string(),
        racy: z.string(),
      })
      .nullable()
      .optional(),
    rejectedFilePath: z.string().optional(),
    pendingFile: PendingMediaProcessingSchema.partial().optional(),
    appealMessage: z.string().optional(),
    appealedAt: z.number().optional(),
    reviewedBy: z.string().optional(),
    reviewedAt: z.number().optional(),
    reviewDecision: z.enum(['approved', 'denied']).optional(),
    reviewNotes: z.string().optional(),
  })
  .superRefine((violation, ctx) => {
    const isMedia = violation.violationType === 'media';
    if (isMedia && violation.mediaKind === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['mediaKind'],
        message: 'mediaKind is required on a media violation',
      });
    }
    if (!isMedia && violation.mediaKind !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['mediaKind'],
        message: 'mediaKind is only allowed on a media violation',
      });
    }
  });
export type ContentViolation = z.infer<typeof ContentViolationSchema>;

export interface ContentViolationActions {
  readonly appeal: boolean;
  readonly accept: boolean;
}

export function contentViolationActions(
  violation: Pick<ContentViolation, 'appealStatus' | 'violationType' | 'timestamp'>,
  now: number,
): ContentViolationActions {
  switch (violation.appealStatus) {
    case 'none':
      return {
        appeal:
          violation.violationType === 'media' &&
          isRejectedMediaAppealOpen(violation.timestamp, now),
        accept: true,
      };
    case 'denied':
      return { appeal: false, accept: true };
    case 'pending':
    case 'approved':
      return { appeal: false, accept: false };
  }
}

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

export const ModerationCascadeActionSchema = z.enum(['hide', 'restore']);
export type ModerationCascadeAction = z.infer<typeof ModerationCascadeActionSchema>;

export const ModerationCascadeStatusSchema = z.enum(['pending', 'complete', 'failed']);
export type ModerationCascadeStatus = z.infer<typeof ModerationCascadeStatusSchema>;

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
export type ModerationCascadeChangedEntityType = z.infer<
  typeof ModerationCascadeChangedEntityTypeSchema
>;

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
export type ModerationCascadeManifestEntityType = z.infer<
  typeof ModerationCascadeManifestEntityTypeSchema
>;
export const MODERATION_HIDE_TARGET_TYPES = ModerationCascadeManifestEntityTypeSchema.options;

export const MODERATION_PARENT_KEYED_TARGET_TYPES = [
  'audition-entry',
  'commission-proposal',
  'hall-library-sub-item',
  'craft-skill',
] as const satisfies readonly ModerationCascadeManifestEntityType[];

export function isModerationParentKeyedTargetType(
  entityType: ModerationCascadeManifestEntityType,
): boolean {
  return (MODERATION_PARENT_KEYED_TARGET_TYPES as readonly string[]).includes(entityType);
}

export interface ModerationTarget {
  readonly entityType: ModerationCascadeManifestEntityType;
  readonly entityId: string;
  readonly parentEntityId?: string;
}

const lengthPrefixed = (part: string): string => `${part.length}:${part}`;

export function moderationTargetKey(target: ModerationTarget): string {
  const parentKeyed = isModerationParentKeyedTargetType(target.entityType);
  if (parentKeyed && !target.parentEntityId) {
    throw new Error(
      `A ${target.entityType} target is keyed under its parent; parentEntityId is required.`,
    );
  }
  if (!parentKeyed && target.parentEntityId !== undefined) {
    throw new Error(
      `A ${target.entityType} target is keyed by its id alone; it carries no parentEntityId.`,
    );
  }
  return [target.entityType, target.parentEntityId ?? '', target.entityId]
    .map(lengthPrefixed)
    .join('');
}

export function moderationCascadeManifestId(
  targetKey: string,
  decision: ModerationDecisionNumber,
): string {
  return `${targetKey}~${decision}`;
}

export function parseModerationTargetKey(targetKey: string): ModerationTarget | null {
  const parts: string[] = [];
  let at = 0;
  while (at < targetKey.length && parts.length < 3) {
    const colon = targetKey.indexOf(':', at);
    if (colon < 0) return null;
    const lengthText = targetKey.slice(at, colon);
    const length = Number(lengthText);
    // Only the canonical prefix the builder writes: `05:` would name the same part a second way.
    if (!/^\d+$/.test(lengthText) || String(length) !== lengthText) return null;
    if (colon + 1 + length > targetKey.length) return null;
    parts.push(targetKey.slice(colon + 1, colon + 1 + length));
    at = colon + 1 + length;
  }
  if (parts.length !== 3 || at !== targetKey.length) return null;
  const [entityType, parentEntityId, entityId] = parts;
  if (!(MODERATION_HIDE_TARGET_TYPES as readonly string[]).includes(entityType) || !entityId) {
    return null;
  }
  const type = entityType as ModerationCascadeManifestEntityType;
  if (isModerationParentKeyedTargetType(type) !== (parentEntityId !== '')) return null;
  return parentEntityId
    ? { entityType: type, entityId, parentEntityId }
    : { entityType: type, entityId };
}

export interface ModerationCascadeManifestIdParts {
  readonly targetKey: string;
  readonly decision: ModerationDecisionNumber;
}

export function parseModerationCascadeManifestId(
  cascadeId: string,
): ModerationCascadeManifestIdParts | null {
  const tilde = cascadeId.lastIndexOf('~');
  if (tilde < 0) return null;
  const targetKey = cascadeId.slice(0, tilde);
  const decisionText = cascadeId.slice(tilde + 1);
  const decision = Number(decisionText);
  if (!ModerationDecisionNumberSchema.safeParse(decision).success) return null;
  if (String(decision) !== decisionText) return null;
  if (!parseModerationTargetKey(targetKey)) return null;
  return { targetKey, decision };
}

export const ModerationCascadeManifestSchema = z
  .object({
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
  })
  .superRefine((manifest, ctx) => {
    let targetKey: string;
    try {
      targetKey = moderationTargetKey(manifest);
    } catch (error) {
      ctx.addIssue({ code: 'custom', path: ['parentEntityId'], message: (error as Error).message });
      return;
    }
    if (manifest.targetKey !== targetKey) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetKey'],
        message: 'targetKey must be moderationTargetKey of the target.',
      });
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
  restoreSkipped: z.literal('directHidden').optional(),
  edgeSyncOwnerType: MediaAssetOwnerTypeSchema.optional(),
  edgeSyncOwnerId: z.string().min(1).optional(),
  edgeSyncAssetIds: z.array(z.string().min(1)).optional(),
});
export type ModerationCascadeChangedDoc = z.infer<typeof ModerationCascadeChangedDocSchema>;
