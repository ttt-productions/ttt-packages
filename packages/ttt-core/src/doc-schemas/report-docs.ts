// Zod schemas for the report-core-owned admin-task-queue Firestore document shape as
// stored in TTT: adminTasks/{taskId} (AdminTask<AdminTaskType>).
//
// The report DOC shapes (contentReports/{reportId} + activeReportGroups/{groupKey}) are
// NO LONGER modeled here — they are owned by the Trust & Safety report spine:
// `ProtectedReportRootV1` + `ReportPublicProjectionV1` + `ReportGroupV1` in ./safety/report.ts.
//
// The admin-task TYPES still align with @ttt-productions/report-core's generic shapes;
// AdminTaskType is the TTT specialization of the generic AdminTask<TTaskType>
// task-type parameter.

import { z } from 'zod';

export const AdminTaskTypeSchema = z.enum([
  'adminDispatch',
  'thresholdLibraryReview',
  'userReport',
  'content-appeal',
  'stakeShareAnomaly',
  'pledgeLedgerAnomaly',
  'pledgePaymentRepairNeeded',
  // Payment refund/dispute admin tray tasks (post-launch handlers). A Stripe chargeback opens a
  // dispute task; a user refund request opens a refund-request task for admin resolution.
  'pledgeDisputeOpened',
  'pledgeRefundRequested',
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
