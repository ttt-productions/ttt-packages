import { z } from 'zod';
import {
  ReportReasonSchema,
  ReportableItemTypeSchema,
  ProtectedForkSchema,
  TargetLocatorV1Schema,
} from './foundation.js';
import {
  MAX_REPORT_NARRATIVE_LENGTH,
  MAX_REPORT_SNAPSHOT_TEXT_LENGTH,
} from '../../constants/business-admin.js';
import { MediaAssetOwnerTypeSchema } from '../media-assets.js';
import {
  ModerationDecisionNumberSchema,
  ModerationEdgeSyncOpSchema,
  ModerationEdgeSyncStateSchema,
} from '../moderation.js';

export const REPORT_CANONICAL_KEY_VERSION = 'v2';

export const ResolvedReportTargetV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    itemType: ReportableItemTypeSchema,
    canonicalParentPath: z.string(),
    canonicalItemId: z.string(),
    revision: z.number(),
    ownerUid: z.string(),
    ownerBlockKey: z.string(),
    mediaAssetId: z.string().optional(),
    channelId: z.string().optional(),
    messageId: z.string().optional(),
    locator: TargetLocatorV1Schema,
    resolvedAt: z.number(),
  })
  .strict();
export type ResolvedReportTargetV1 = z.infer<typeof ResolvedReportTargetV1Schema>;

export const ReportTargetSnapshotV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    itemType: ReportableItemTypeSchema,
    canonicalItemId: z.string(),
    revision: z.number(),
    contentSummaryRef: z.string(),
    contentHashes: z.array(z.string()).max(16).optional(),
    capturedText: z.string().max(MAX_REPORT_SNAPSHOT_TEXT_LENGTH).optional(),
    capturedMediaAssetIds: z.array(z.string()).max(32).optional(),
    capturedAt: z.number(),
  })
  .strict();
export type ReportTargetSnapshotV1 = z.infer<typeof ReportTargetSnapshotV1Schema>;

export const NarrativeRecordV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    reportId: z.string().min(1),
    reporterUid: z.string().min(1),
    text: z.string().min(1).max(MAX_REPORT_NARRATIVE_LENGTH),
    createdAt: z.number(),
  })
  .strict();
export type NarrativeRecordV1 = z.infer<typeof NarrativeRecordV1Schema>;

export const ProtectedReportRootStatusSchema = z.enum([
  'pending_review',
  'grouped',
  'actioned',
  'dismissed',
]);
export type ProtectedReportRootStatus = z.infer<typeof ProtectedReportRootStatusSchema>;

export const ProtectedReportRootV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    reportId: z.string().min(1),
    reporterUid: z.string().min(1),
    reason: ReportReasonSchema,
    resolvedTarget: ResolvedReportTargetV1Schema,
    snapshotRef: z.string(),
    canonicalTargetKey: z.string(),
    narrativeRef: z.string().optional(),
    protectedFork: ProtectedForkSchema.optional(),
    escalatedToCase: z.string().min(1).optional(),
    status: ProtectedReportRootStatusSchema,
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .strict();
export type ProtectedReportRootV1 = z.infer<typeof ProtectedReportRootV1Schema>;

export const ReportPublicProjectionV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    reportId: z.string().min(1),
    itemType: ReportableItemTypeSchema,
    reason: ReportReasonSchema,
    status: ProtectedReportRootStatusSchema,
    createdAt: z.number(),
  })
  .strict();
export type ReportPublicProjectionV1 = z.infer<typeof ReportPublicProjectionV1Schema>;

export const ReportGroupModerationStateSchema = z.enum([
  'admin_hidden',
  'resolved_restored',
  'resolved_removed',
]);
export type ReportGroupModerationState = z.infer<typeof ReportGroupModerationStateSchema>;

export const ReportGroupResolutionOutcomeSchema = z.enum(['founded', 'unfounded']);
export type ReportGroupResolutionOutcome = z.infer<typeof ReportGroupResolutionOutcomeSchema>;

export const ReportGroupV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    groupKey: z.string().min(1),
    itemType: ReportableItemTypeSchema,
    totalReports: z.number(),
    highestReasonScore: z.number(),
    lastReportAt: z.number(),
    latestReason: ReportReasonSchema,
    status: z.enum(['pending', 'reviewing', 'processing', 'failed', 'resolved']),

    reportedItemId: z.string().min(1).optional(),
    parentItemId: z.string().nullable().optional(),
    reportedUserId: z.string().min(1),

    moderationState: ReportGroupModerationStateSchema.optional(),
    contentHidden: z.boolean().optional(),
    moderatedAt: z.number().optional(),

    edgeSyncState: ModerationEdgeSyncStateSchema.nullable().optional(),
    edgeSyncProcessingAt: z.number().optional(),
    edgeSyncOp: ModerationEdgeSyncOpSchema.optional(),
    edgeSyncDecision: ModerationDecisionNumberSchema.optional(),
    edgeSyncOwnerType: MediaAssetOwnerTypeSchema.optional(),
    edgeSyncOwnerId: z.string().min(1).optional(),
    edgeSyncAssetIds: z.array(z.string().min(1)).optional(),
    edgeSyncError: z.string().optional(),
    edgeSyncFailedAt: z.number().optional(),

    resolutionOutcome: ReportGroupResolutionOutcomeSchema.optional(),
    resolvedBy: z.string().min(1).optional(),
    resolvedAt: z.number().optional(),
    resolutionUserFacingReasonCode: z.string().optional(),
    resolutionUserFacingReasonDetail: z.string().optional(),
    resolutionAdminNote: z.string().optional(),

    tombstoneAppliedAt: z.number().optional(),
    lastError: z.string().nullable().optional(),
    failedAt: z.number().nullable().optional(),
    failedCommandDocId: z.string().min(1).optional(),

    supersededByCaseId: z.string().min(1).optional(),
    supersededAt: z.number().optional(),
    supersededPartialAt: z.number().optional(),

    pendingHoldRelease: z.boolean().optional(),

    pendingRootTerminalization: z.boolean().optional(),
  })
  .strict();
export type ReportGroupV1 = z.infer<typeof ReportGroupV1Schema>;

export const ReportGroupCountedReportSchema = z
  .object({
    reportId: z.string().min(1),
    countedAt: z.number(),
  })
  .strict();
export type ReportGroupCountedReport = z.infer<typeof ReportGroupCountedReportSchema>;
