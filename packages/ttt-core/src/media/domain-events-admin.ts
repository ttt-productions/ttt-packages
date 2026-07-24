import { z } from "zod";
import { FileOriginSchema } from "./file-origin.js";

// DomainEvent schemas for the admin/moderation domain — content violations,
// threshold-library review decisions, admin dispatch, and appeals. Assembled
// into the discriminated union in ./domain-events.ts.

export const ModerationViolationCreatedEventSchema = z
  .object({
    type: z.literal('moderation.violationCreated'),
    ids: z
      .object({
        userId: z.string().min(1),
        violationId: z.string().min(1),
        fileOrigin: FileOriginSchema,
        pendingMediaId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ThresholdLibraryApprovedEventSchema = z
  .object({
    type: z.literal('thresholdLibrary.approved'),
    ids: z
      .object({
        thresholdItemId: z.string().min(1),
        hallItemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ThresholdLibraryNeedsRevisionEventSchema = z
  .object({
    type: z.literal('thresholdLibrary.needsRevision'),
    ids: z
      .object({
        thresholdItemId: z.string().min(1),
        hallItemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const AdminDispatchSystemMarkedEventSchema = z
  .object({
    type: z.literal('adminDispatch.systemMarked'),
    ids: z
      .object({
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const AdminDispatchThreadUpdatedEventSchema = z
  .object({
    type: z.literal('adminDispatch.threadUpdated'),
    ids: z
      .object({
        adminDispatchId: z.string().min(1).nullable(),
      })
      .strict(),
  })
  .strict();

export const AdminAppealReviewedEventSchema = z
  .object({
    type: z.literal('admin.appealReviewed'),
    ids: z
      .object({
        violationId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const AdminDispatchReviewedEventSchema = z
  .object({
    type: z.literal('admin.adminDispatchReviewed'),
    ids: z.object({}).strict(),
  })
  .strict();

export const ViolationAppealSubmittedEventSchema = z
  .object({
    type: z.literal('violation.appealSubmitted'),
    ids: z
      .object({
        userId: z.string().min(1),
        violationId: z.string().min(1),
      })
      .strict(),
  })
  .strict();
