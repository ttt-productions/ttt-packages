import { z } from 'zod';
import {
  HALL_CONTENT_DETAIL_SURFACES,
  HALL_CONTENT_SUB_ITEM_SURFACES,
} from '../constants/hall-content-routing.js';

export const WorkProjectCreatedEventSchema = z
  .object({
    type: z.literal('workProject.created'),
    ids: z
      .object({
        userId: z.string().min(1),
        workProjectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const WorkProjectUpdatedEventSchema = z
  .object({
    type: z.literal('workProject.updated'),
    ids: z.object({ workProjectId: z.string().min(1) }).strict(),
  })
  .strict();

export const WorkProjectPublishedEventSchema = z
  .object({
    type: z.literal('workProject.published'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        userId: z.string().min(1),
        workRealmId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const WorkProjectStakeSharesUpdatedEventSchema = z
  .object({
    type: z.literal('workProject.stakeSharesUpdated'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const GuildInviteSentEventSchema = z
  .object({
    type: z.literal('workProject.guildInviteSent'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        guildInviteId: z.string().min(1),
        inviterId: z.string().min(1),
        inviteeId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const GuildInviteAcceptedEventSchema = z
  .object({
    type: z.literal('workProject.guildInviteAccepted'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        guildInviteId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const GuildInviteDeclinedEventSchema = z
  .object({
    type: z.literal('workProject.guildInviteDeclined'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        guildInviteId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const GuildInviteCancelledEventSchema = z
  .object({
    type: z.literal('workProject.guildInviteCancelled'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        guildInviteId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const WorkProjectGuildmateLeftEventSchema = z
  .object({
    type: z.literal('workProject.guildmateLeft'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const AuditionPromptCreatedEventSchema = z
  .object({
    type: z.literal('audition.promptCreated'),
    ids: z
      .object({
        userId: z.string().min(1),
        auditionId: z.string().min(1),
        workProjectId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const AuditionEntrySubmittedEventSchema = z
  .object({
    type: z.literal('audition.entryCreated'),
    ids: z
      .object({
        userId: z.string().min(1),
        auditionId: z.string().min(1),
        auditionEntryId: z.string().min(1),
        previousAuditionEntryId: z.string().min(1).optional(),
        workProjectId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const AuditionEntryVoteRecordedEventSchema = z
  .object({
    type: z.literal('audition.entryVoted'),
    ids: z
      .object({
        userId: z.string().min(1),
        auditionId: z.string().min(1),
        auditionEntryId: z.string().min(1),
        workProjectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const AuditionClosedEventSchema = z
  .object({
    type: z.literal('audition.closed'),
    ids: z
      .object({
        auditionId: z.string().min(1),
        workProjectId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const CommissionCreatedEventSchema = z
  .object({
    type: z.literal('commission.created'),
    ids: z
      .object({
        userId: z.string().min(1),
        commissionListingId: z.string().min(1),
        workProjectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CommissionProposalSubmittedEventSchema = z
  .object({
    type: z.literal('commission.commissionProposalSubmitted'),
    ids: z
      .object({
        userId: z.string().min(1),
        commissionListingId: z.string().min(1),
        workProjectId: z.string().min(1),
        commissionProposalId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CommissionClosedEventSchema = z
  .object({
    type: z.literal('commission.closed'),
    ids: z
      .object({
        commissionListingId: z.string().min(1),
        workProjectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CommissionProposalSavedEventSchema = z
  .object({
    type: z.literal('commission.commissionProposalSaved'),
    ids: z
      .object({
        commissionListingId: z.string().min(1),
        commissionProposalId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CommissionProposalRemovedEventSchema = z
  .object({
    type: z.literal('commission.commissionProposalRemoved'),
    ids: z
      .object({
        commissionListingId: z.string().min(1),
        commissionProposalId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const HallLibraryCoverUpdatedEventSchema = z
  .object({
    type: z.literal('hallLibrary.coverUpdated'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        itemType: z.enum(HALL_CONTENT_DETAIL_SURFACES),
        itemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const WorkRealmCoverUpdatedEventSchema = z
  .object({
    type: z.literal('workRealm.coverUpdated'),
    ids: z
      .object({
        workRealmId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const WorkRealmDetailsUpdatedEventSchema = z
  .object({
    type: z.literal('workRealm.detailsUpdated'),
    ids: z
      .object({
        workRealmId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const HallLibrarySubItemUpdatedEventSchema = z
  .object({
    type: z.literal('hallLibrary.subItemUpdated'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        itemType: z.enum(HALL_CONTENT_SUB_ITEM_SURFACES),
        parentId: z.string().min(1),
        itemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ThresholdLibrarySubmittedEventSchema = z
  .object({
    type: z.literal('thresholdLibrary.submitted'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();
