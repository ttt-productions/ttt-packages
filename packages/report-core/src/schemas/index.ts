import { z } from 'zod';

// Wire-format schemas for the report-core admin task callables.
// Consumed by the consuming app's onCall wrappers; the handlers in ../server/
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

// The Trust & Safety `submitReport` callable wire shape. report-core is a GENERIC
// Tier-1 package — it cannot import ttt-core's ReportReason / ReportableItemType
// enums, so `itemType` and `reason` are typed as opaque strings here; the consuming
// app's submitReport callable validates them against the canonical ttt-core enums.
// `reportedUserId` is a HINT ONLY — the server re-derives the owner and never trusts
// it as authority. `comment` is the free-text reporter narrative (segregated server-side).
export const SubmitReportRequestSchema = z.object({
  itemType: z.string().min(1).max(64),
  reportedItemId: z.string().min(1).max(256),
  parentItemId: z.string().min(1).max(256).optional(),
  reportedUserId: z.string().min(1).max(256).optional(),
  reason: z.string().min(1).max(128),
  comment: z.string().max(4000).optional(),
}).strict();

export type SubmitReportRequest = z.infer<typeof SubmitReportRequestSchema>;

/** The `submitReport` callable result. `protectedFork`/`caseId` are non-null only when
 *  the protected branch (child-safety / NCII) ran; idempotent duplicates still return ok. */
export interface SubmitReportResult {
  ok: true;
  reportId: string;
  reason: string;
  protectedFork: 'childSafetyCase' | 'nciiCase' | null;
  caseId: string | null;
}
