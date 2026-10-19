import { z } from 'zod';

// Wire-format schemas for the report-core admin task callables.
// Consumed by the consuming app's onCall wrappers; the handlers in ../server/
// re-import the inferred types so the schema is the single source of truth.

export const CheckoutTaskRequestSchema = z.object({
  taskType: z.string().min(1),
  specificTaskId: z.string().min(1).optional(),
}).strict();

export type CheckoutTaskRequest = z.infer<typeof CheckoutTaskRequestSchema>;

/**
 * A free-text field's schema, built by the consuming app over its own field declaration: its
 * format, its bounds, its trim, and whether it may be absent are the app's (ARCH-201, ARCH-102).
 */
export type ReportTextFieldSchema = z.ZodType<string | undefined, unknown>;

/** The check-in request, its `resolution` note judged by the app's field schema. */
export function createCheckinTaskRequestSchema<R extends ReportTextFieldSchema>(fields: { resolution: R }) {
  return z.object({
    taskId: z.string().min(1),
    resolved: z.boolean(),
    resolution: fields.resolution,
  }).strict();
}

/** A check-in request whose resolution note is optional text — the shape the handler reads. */
export type CheckinTaskRequest = z.infer<
  ReturnType<typeof createCheckinTaskRequestSchema<z.ZodOptional<z.ZodString>>>
>;

export const ReleaseTaskRequestSchema = z.object({
  taskId: z.string().min(1),
}).strict();

export type ReleaseTaskRequest = z.infer<typeof ReleaseTaskRequestSchema>;

// The Trust & Safety `submitReport` callable wire shape. report-core is a GENERIC
// Tier-1 package — it cannot import the app core package's ReportReason /
// ReportableItemType enums, so `itemType` and `reason` are typed as opaque strings
// here; the consuming app's submitReport callable validates them against the
// canonical app-core enums.
// `reportedUserId` is a HINT ONLY — the server re-derives the owner and never trusts
// it as authority. `comment` is the free-text reporter narrative (segregated server-side), judged
// by the app's field schema — the same declaration the dialog's `reportCommentInput` carries.
export function createSubmitReportRequestSchema<C extends ReportTextFieldSchema>(fields: { comment: C }) {
  return z.object({
    itemType: z.string().min(1).max(64),
    reportedItemId: z.string().min(1).max(256),
    parentItemId: z.string().min(1).max(256).optional(),
    reportedUserId: z.string().min(1).max(256).optional(),
    reason: z.string().min(1).max(128),
    comment: fields.comment,
    // When true, this is the user-confirmed SECOND call that escalates an EXISTING report on the same
    // target to a protected reason (Child Safety / NCII). Only meaningful when `reason` is a protected
    // reason and the reporter already has a report on this target; the server then opens the protected
    // case for the existing report (the original deadline/disposition is preserved). Ignored otherwise.
    confirmUpgrade: z.boolean().optional(),
  }).strict();
}

/** A submit request whose comment is optional text — the shape the dialog's hook sends. */
export type SubmitReportRequest = z.infer<
  ReturnType<typeof createSubmitReportRequestSchema<z.ZodOptional<z.ZodString>>>
>;

/**
 * The `submitReport` callable result — discriminated on `outcome`.
 *
 * One report per reporter per target+revision:
 *  - `filed`            — a new report was created (today's shape). `protectedFork`/`caseId` are
 *                         non-null only when the protected branch ran on this first submission.
 *  - `alreadyReported`  — the reporter already reported this item under an ordinary reason; denied
 *                         honestly, no new work created.
 *  - `upgradeAvailable` — the reporter already reported this item and the NEW reason is protected
 *                         (Child Safety / NCII), not yet confirmed; the UI prompts to upgrade the
 *                         existing report. A second call with `confirmUpgrade: true` performs it.
 *  - `upgraded`         — an existing report was escalated to a protected case (confirmUpgrade path).
 */
export type SubmitReportResult =
  | {
      outcome: 'filed';
      ok: true;
      reportId: string;
      reason: string;
      protectedFork: 'childSafetyCase' | 'nciiCase' | null;
      caseId: string | null;
    }
  | {
      outcome: 'alreadyReported';
      reportId: string;
    }
  | {
      outcome: 'upgradeAvailable';
      reportId: string;
      reason: string;
    }
  | {
      outcome: 'upgraded';
      reportId: string;
      reason: string;
      protectedFork: 'childSafetyCase' | 'nciiCase';
      caseId: string;
    };
