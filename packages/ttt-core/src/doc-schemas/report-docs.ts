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
  // A member's proposal to change TEXT fields on a PUBLISHED hall item — reviewed in the same
  // admin queue as library publishes (hallContentChangeRequests/{changeRequestId} is the source doc).
  'hallContentChangeRequest',
]);
export type AdminTaskType = z.infer<typeof AdminTaskTypeSchema>;

export const AdminTaskStatusSchema = z.enum(['pending', 'checkedOut', 'workLater', 'completed']);

export const CheckoutDetailsSchema = z.object({
  userId: z.string(),
  checkedOutAt: z.number(),
  expiresAt: z.number(),
  workLaterUntil: z.number().nullable(),
});

/**
 * One prior closure of a userReport task, appended to `closureHistory` when a new distinct
 * report resurfaces a previously-closed report group. ONE shape for BOTH reopen paths:
 * the in-place reopen of a task still sitting there `completed` (its own `completedAt`), and
 * the recreate of a task the guided close-out deleted (the group's `resolvedAt` — the same
 * close-out batch wrote both, so they are the same fact from two survivors). `completedAt`
 * is null when neither survivor recorded the closure instant.
 */
export const AdminTaskClosureHistoryEntrySchema = z.object({
  completedAt: z.number().nullable(),
  reopenedAt: z.number(),
});
export type AdminTaskClosureHistoryEntry = z.infer<typeof AdminTaskClosureHistoryEntrySchema>;

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
  // Absent on a task that is not completed. A REOPEN deletes the field (FieldValue.delete()),
  // never writes null — a reopened task is shape-identical to a pending one, so "not
  // completed" has exactly one representation.
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
//   userReport             → report-core's createAdminTaskHandler + the app's
//                            runOnReportCreated (report identity: reportedUserId /
//                            reportedItemType / reportedItemId / parentItemId; reopen:
//                            closureHistory)
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
  // Party-generic dispatch (adminDispatch tasks) + change-request tasks: the queue card
  // says which party/content the item is about. Denormalized from the source doc.
  partyKind: z.enum(['user', 'workProject']).optional(),
  workProjectId: z.string().optional(),
  hallItemId: z.string().optional(),
  // userReport tasks — report identity, denormalized by report-core's task creator so admin
  // task surfaces can filter/scope without re-reading the group. Null (not absent) when the
  // writer had no value: an unresolved chat sender has no reportedUserId, a parentless item
  // no parentItemId — the Admin SDK rejects `undefined`, so writers coalesce to null.
  reportedUserId: z.string().nullable().optional(),
  reportedItemType: z.string().nullable().optional(),
  reportedItemId: z.string().nullable().optional(),
  parentItemId: z.string().nullable().optional(),
  // userReport tasks — prior closures, appended (arrayUnion) when a new distinct report
  // resurfaces a closed report group. Cross-boundary: Functions writes it, the admin queue
  // UI reads it.
  closureHistory: z.array(AdminTaskClosureHistoryEntrySchema).optional(),
});
export type AdminTaskDoc = z.infer<typeof AdminTaskDocSchema>;
