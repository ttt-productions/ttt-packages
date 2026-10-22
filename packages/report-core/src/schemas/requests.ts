import { z } from 'zod';

export const CheckoutTaskRequestSchema = z
  .object({
    taskType: z.string().min(1),
    specificTaskId: z.string().min(1).optional(),
  })
  .strict();

export type CheckoutTaskRequest = z.infer<typeof CheckoutTaskRequestSchema>;

export type ReportTextFieldSchema = z.ZodType<string | undefined, unknown>;

export function createCheckinTaskRequestSchema<R extends ReportTextFieldSchema>(fields: {
  resolution: R;
}) {
  return z
    .object({
      taskId: z.string().min(1),
      resolved: z.boolean(),
      resolution: fields.resolution,
    })
    .strict();
}

export type CheckinTaskRequest = z.infer<
  ReturnType<typeof createCheckinTaskRequestSchema<z.ZodOptional<z.ZodString>>>
>;

export const ReleaseTaskRequestSchema = z
  .object({
    taskId: z.string().min(1),
  })
  .strict();

export type ReleaseTaskRequest = z.infer<typeof ReleaseTaskRequestSchema>;

export function createSubmitReportRequestSchema<C extends ReportTextFieldSchema>(fields: {
  comment: C;
}) {
  return z
    .object({
      itemType: z.string().min(1).max(64),
      reportedItemId: z.string().min(1).max(256),
      parentItemId: z.string().min(1).max(256).optional(),
      reportedUserId: z.string().min(1).max(256).optional(),
      reason: z.string().min(1).max(128),
      comment: fields.comment,
      confirmUpgrade: z.boolean().optional(),
    })
    .strict();
}

export type SubmitReportRequest = z.infer<
  ReturnType<typeof createSubmitReportRequestSchema<z.ZodOptional<z.ZodString>>>
>;

export type SubmitReportResult<TProtectedFork extends string = string> =
  | {
      outcome: 'filed';
      ok: true;
      reportId: string;
      reason: string;
      protectedFork: TProtectedFork | null;
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
      protectedFork: TProtectedFork;
      caseId: string;
    };
