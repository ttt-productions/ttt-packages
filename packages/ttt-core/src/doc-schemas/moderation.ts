// Moderation Firestore document SCHEMAS — contentViolations/{id}, the content-appeal
// admin task, and the moderationCascadeManifests/{id} (+ changedDocs) records.
// Types inferred via z.infer.

import { z } from 'zod';
import { PendingMediaPendingSchema } from '../media/pending-media.js';
import { AdminTaskSchema } from './report-docs.js';

export const ContentViolationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  fileType: z.string(),
  violationType: z.enum(['text', 'media']).optional(),
  originalFileName: z.string(),
  reason: z.string(),
  scores: z.object({
    adult: z.string(),
    violence: z.string(),
    racy: z.string(),
  }),
  timestamp: z.number(),
  rejectedFilePath: z.string(),
  rejectedFileUrl: z.string().optional(),
  appealStatus: z.enum(['none', 'pending', 'approved', 'denied']),
  appealMessage: z.string().optional(),
  appealedAt: z.number().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.number().optional(),
  reviewDecision: z.enum(['approved', 'denied']).optional(),
  reviewNotes: z.string().optional(),
  pendingFile: PendingMediaPendingSchema.partial(),
});
export type ContentViolation = z.infer<typeof ContentViolationSchema>;

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

export const ModerationCascadeActionSchema = z.enum(['hideRealm', 'restoreRealm']);
export type ModerationCascadeAction = z.infer<typeof ModerationCascadeActionSchema>;

export const ModerationCascadeStatusSchema = z.enum(['pending', 'complete', 'failed']);
export type ModerationCascadeStatus = z.infer<typeof ModerationCascadeStatusSchema>;

export const ModerationCascadeChangedEntityTypeSchema = z.enum([
  'workProject',
  'hallItem',
  'subItemProjection',
  'workRealm',
]);
export type ModerationCascadeChangedEntityType = z.infer<typeof ModerationCascadeChangedEntityTypeSchema>;

export const ModerationCascadeManifestSchema = z.object({
  cascadeId: z.string(),
  action: ModerationCascadeActionSchema,
  entityType: z.literal('workRealm'),
  entityId: z.string(),
  actorUid: z.string(),
  reason: z.string(),
  createdAt: z.number(),
  completedAt: z.number().optional(),
  status: ModerationCascadeStatusSchema,
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
});
export type ModerationCascadeChangedDoc = z.infer<typeof ModerationCascadeChangedDocSchema>;
