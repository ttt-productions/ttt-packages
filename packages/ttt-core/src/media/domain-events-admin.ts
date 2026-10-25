import { z } from 'zod';
import { FileOriginSchema } from './file-origin.js';
import { SystemAccountSlotIdSchema } from '../system-slots/system-slots.js';

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

export const HallContentChangeRequestApprovedEventSchema = z
  .object({
    type: z.literal('hallContentChangeRequest.approved'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        workRealmId: z.string().min(1).optional(),
        hallItemId: z.string().min(1).optional(),
        subItemId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const ViolationDecisionAcceptedEventSchema = z
  .object({
    type: z.literal('violation.decisionAccepted'),
    ids: z
      .object({
        userId: z.string().min(1),
        violationId: z.string().min(1),
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

export const SystemSlotUidUpdatedEventSchema = z
  .object({
    type: z.literal('systemSlot.uidUpdated'),
    ids: z
      .object({
        slotId: SystemAccountSlotIdSchema,
      })
      .strict(),
  })
  .strict();

export const WorkRealmHiddenEventSchema = z
  .object({
    type: z.literal('workRealm.hidden'),
    ids: z.object({ workRealmId: z.string().min(1) }).strict(),
  })
  .strict();

export const WorkRealmRestoredEventSchema = z
  .object({
    type: z.literal('workRealm.restored'),
    ids: z.object({ workRealmId: z.string().min(1) }).strict(),
  })
  .strict();

export const WorkRealmRetitleRequiredEventSchema = z
  .object({
    type: z.literal('workRealm.retitleRequired'),
    ids: z.object({ workRealmId: z.string().min(1) }).strict(),
  })
  .strict();

export const WorkRealmTextClearedEventSchema = z
  .object({
    type: z.literal('workRealm.textCleared'),
    ids: z.object({ workRealmId: z.string().min(1) }).strict(),
  })
  .strict();

export const WorkProjectHiddenEventSchema = z
  .object({
    type: z.literal('workProject.hidden'),
    ids: z.object({ workProjectId: z.string().min(1) }).strict(),
  })
  .strict();

export const WorkProjectRestoredEventSchema = z
  .object({
    type: z.literal('workProject.restored'),
    ids: z.object({ workProjectId: z.string().min(1) }).strict(),
  })
  .strict();

export const WorkProjectRetitleRequiredEventSchema = z
  .object({
    type: z.literal('workProject.retitleRequired'),
    ids: z.object({ workProjectId: z.string().min(1) }).strict(),
  })
  .strict();

export const WorkProjectTextClearedEventSchema = z
  .object({
    type: z.literal('workProject.textCleared'),
    ids: z.object({ workProjectId: z.string().min(1) }).strict(),
  })
  .strict();

export const HallSubItemHiddenEventSchema = z
  .object({
    type: z.literal('hallLibrary.subItemHidden'),
    ids: z
      .object({
        hallItemId: z.string().min(1),
        subItemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const HallSubItemRestoredEventSchema = z
  .object({
    type: z.literal('hallLibrary.subItemRestored'),
    ids: z
      .object({
        hallItemId: z.string().min(1),
        subItemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const HallSubItemTextClearedEventSchema = z
  .object({
    type: z.literal('hallLibrary.subItemTextCleared'),
    ids: z
      .object({
        hallItemId: z.string().min(1),
        subItemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();
