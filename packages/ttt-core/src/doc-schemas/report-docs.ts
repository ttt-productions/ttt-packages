import { z } from 'zod';

export const AdminTaskTypeSchema = z.enum([
  'adminDispatch',
  'thresholdLibraryReview',
  'userReport',
  'content-appeal',
  'stakeShareAnomaly',
  'pledgeLedgerAnomaly',
  'pledgePaymentRepairNeeded',
  'pledgeDisputeOpened',
  'pledgeRefundRequested',
  'pledgeRefundFailed',
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
  completedAt: z.number().optional(),
  itemData: z.unknown().optional(),
});

// A superset of optionals, not a discriminated union, so the drift-check keeps detecting unknown
// top-level fields.
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
  partyKind: z.enum(['user', 'workProject']).optional(),
  workProjectId: z.string().optional(),
  hallItemId: z.string().optional(),
  // Null, not absent: the Admin SDK rejects `undefined`, so writers coalesce to null.
  reportedUserId: z.string().nullable().optional(),
  reportedItemType: z.string().nullable().optional(),
  reportedItemId: z.string().nullable().optional(),
  parentItemId: z.string().nullable().optional(),
  closureHistory: z.array(AdminTaskClosureHistoryEntrySchema).optional(),
  supersededByCaseId: z.string().min(1).optional(),
});
export type AdminTaskDoc = z.infer<typeof AdminTaskDocSchema>;
