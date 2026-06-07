import { z } from 'zod';

// Wire-format schemas for the report-core admin task callables.
// Consumed by the consuming app's onCall wrappers; the handlers in ../server/
// re-import the inferred types so the schema is the single source of truth.

export const CheckoutTaskRequestSchema = z.object({
  taskType: z.string().min(1),
}).strict();

export type CheckoutTaskRequest = z.infer<typeof CheckoutTaskRequestSchema>;

export const CheckinTaskRequestSchema = z.object({
  taskId: z.string().min(1),
  resolved: z.boolean(),
  resolution: z.string().max(2000).optional(),
}).strict();

export type CheckinTaskRequest = z.infer<typeof CheckinTaskRequestSchema>;

export const ReleaseTaskRequestSchema = z.object({
  taskId: z.string().min(1),
}).strict();

export type ReleaseTaskRequest = z.infer<typeof ReleaseTaskRequestSchema>;

export const CreateContentReportRequestSchema = z.object({
  reportedItemType: z.string().min(1).max(64),
  reportedItemId: z.string().min(1).max(128),
  parentItemId: z.string().min(1).max(128).optional(),
  reportedUserId: z.string().min(1).max(128).optional(),
  reason: z.string().min(1).max(128),
  comment: z.string().min(1).max(4000),
}).strict();

export type CreateContentReportRequest = z.infer<typeof CreateContentReportRequestSchema>;
