// Zod schemas for the report-core-owned Firestore document shapes as stored in TTT:
// adminTasks/{taskId} (AdminTask<AdminTaskType>), contentReports/{reportId} (Report),
// activeReportGroups/{groupKey} (ReportGroup), adminActivityLog/{logId} (ActivityLogEntry).
//
// The canonical TYPES live in @ttt-productions/report-core/contracts; these schemas are
// authored to match them so the schema registry + drift-check have runtime schemas. A
// type-parity test (parity.test.ts) asserts z.infer here === the report-core types, so
// they cannot silently drift. AdminTaskType is the TTT specialization of the generic
// AdminTask<TTaskType> task-type parameter.

import { z } from 'zod';

export const AdminTaskTypeSchema = z.enum([
  'adminDispatch',
  'thresholdLibraryReview',
  'userReport',
  'content-appeal',
  'stakeShareAnomaly',
  'pledgeLedgerAnomaly',
  'pledgePaymentRepairNeeded',
]);
export type AdminTaskType = z.infer<typeof AdminTaskTypeSchema>;

export const AdminTaskStatusSchema = z.enum(['pending', 'checkedOut', 'workLater', 'completed']);

export const CheckoutDetailsSchema = z.object({
  userId: z.string(),
  checkedOutAt: z.number(),
  expiresAt: z.number(),
  workLaterUntil: z.number().nullable(),
});

export const AdminTaskSchema = z.object({
  id: z.string(),
  taskType: AdminTaskTypeSchema,
  taskId: z.string(),
  originalPath: z.string(),
  status: AdminTaskStatusSchema,
  checkoutDetails: CheckoutDetailsSchema.nullable(),
  summary: z.string(),
  priority: z.number(),
  createdAt: z.number(),
  lastUpdatedAt: z.number(),
  completedAt: z.number().optional(),
  itemData: z.unknown().optional(),
});

// The STORED `adminTasks/{taskId}` doc. `AdminTaskSchema` above is the READ model — report-core's
// read hooks inject `id` from the doc id, so stored docs omit `id` (only the content-appeal writer
// persists it). The queue is polymorphic: each task type denormalizes a few top-level fields for
// the admin browse view. Modeled as a superset-of-optionals (NOT a discriminated union) so the
// drift-check keeps top-level unknown-field detection. Per-type writers (functions/src):
//   content-appeal         → submitContentAppeal.ts (id, violationId, userId, fileType,
//                            rejectionReason, appealMessage, rejectedFilePath)
//   thresholdLibraryReview → runSubmitForThresholdLibraryReview.ts (foundingArtisanUid)
//   stakeShareAnomaly      → runWorkProjectGuildmateUserStakeShareAudit.ts (metadata)
//   adminDispatch          → runStartAdminSupportThread.ts (no extras)
// (userReport tasks read from activeReportGroups — no adminTasks doc is written for them.)
export const AdminTaskDocSchema = AdminTaskSchema.extend({
  id: z.string().optional(),
  violationId: z.string().optional(),
  userId: z.string().optional(),
  fileType: z.string().optional(),
  rejectionReason: z.string().optional(),
  appealMessage: z.string().optional(),
  rejectedFilePath: z.string().optional(),
  foundingArtisanUid: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AdminTaskDoc = z.infer<typeof AdminTaskDocSchema>;

export const ReportStatusSchema = z.enum([
  'pending_review',
  'resolved_no_action',
  'resolved_action_taken',
]);
export const ReportGroupStatusSchema = z.enum(['pending', 'reviewing', 'resolved']);

export const ReportSchema = z.object({
  reportId: z.string(),
  reporterUserId: z.string(),
  reportedItemType: z.string(),
  reportedItemId: z.string(),
  parentItemId: z.string().optional(),
  reportedUserId: z.string().optional(),
  reason: z.string(),
  comment: z.string(),
  createdAt: z.number(),
  status: ReportStatusSchema,
  resolvedAt: z.number().optional(),
  resolvedBy: z.string().optional(),
  adminNotes: z.string().optional(),
});

export const ReportGroupSchema = z.object({
  groupKey: z.string(),
  reportedItemId: z.string(),
  reportedItemType: z.string(),
  reportedUserId: z.string().nullable(),
  lastReportAt: z.number(),
  totalReports: z.number(),
  status: ReportGroupStatusSchema,
  reports: z.array(ReportSchema).optional(),
});

export const ActivityActionSchema = z.enum([
  'checkout',
  'checkout_next_important',
  'checkin_resolved',
  'checkin_unresolved',
  'release',
  'mark_work_later',
  'auto_released',
  'auto_released_scheduled',
]);

export const ActivityLogEntrySchema = z.object({
  id: z.string(),
  adminUserId: z.string(),
  action: ActivityActionSchema,
  taskType: z.string(),
  taskId: z.string(),
  timestamp: z.number(),
  resolution: z.string().optional(),
  timeSpentMinutes: z.number().optional(),
  extendHours: z.number().optional(),
  priority: z.number().optional(),
});
