import { z } from 'zod';

// Wire-format schemas for the report-core admin task callables.
// Consumed by ttt-prod's onCall wrappers; the handlers in ../server/
// re-import the inferred types so the schema is the single source of truth.

export const CheckoutTaskRequestSchema = z.object({
  taskType: z.string().min(1),
  specificTaskId: z.string().min(1).optional(),
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
