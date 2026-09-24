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

// An admin forced a display-name reset on a member. The target's displayName is
// a publicUsers-mirrored field; the actor is an admin, never the member, which
// is why this is separate from profile.displayNameChanged.
export const AdminDisplayNameResetForcedEventSchema = z
  .object({
    type: z.literal('admin.displayNameResetForced'),
    ids: z
      .object({
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

// A hall content change request was APPROVED — the only decision that writes
// anything. An approval updates the public Work shell and, on the realm grain,
// the Realm doc, so both ids ride the event; `workRealmId` is absent on the hall
// grains. A denial changes no content and emits nothing.
export const HallContentChangeRequestApprovedEventSchema = z
  .object({
    type: z.literal('hallContentChangeRequest.approved'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        workRealmId: z.string().min(1).optional(),
      })
      .strict(),
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
