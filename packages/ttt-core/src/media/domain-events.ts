import { z } from "zod";
import { FileOriginSchema } from "./file-origin.js";

// ============================================================================
// DomainEvent — typed business actions emitted by mutations and upload
// processors. The frontend registry (ttt-prod/src/lib/domain-events.ts) maps
// each variant to a list of TanStack Query cache invalidations.
//
// Adding a new variant is a coordinated deploy:
//   1. Add it here. Publish this package.
//   2. Add a registry entry in ttt-prod. Deploy.
//   3. Update producers (mutation hooks or processors) to emit it.
//
// The schema is .strict() end-to-end — unknown event types fail parse and
// the consuming hook in ttt-prod logs to Sentry and skips the doc.
// ============================================================================

export const ProfilePictureUpdatedEventSchema = z
  .object({
    type: z.literal('profile.pictureUpdated'),
    ids: z.object({ userId: z.string().min(1) }).strict(),
  })
  .strict();

export const CraftSkillCreatedEventSchema = z
  .object({
    type: z.literal('craftSkill.created'),
    ids: z
      .object({
        userId: z.string().min(1),
        craftSkillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const SquareStreetzPostCreatedEventSchema = z
  .object({
    type: z.literal('squareStreetz.postCreated'),
    ids: z
      .object({
        userId: z.string().min(1),
        postId: z.string().min(1),
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

export const WorkProjectUpdatedEventSchema = z
  .object({
    type: z.literal('workProject.updated'),
    ids: z.object({ workProjectId: z.string().min(1) }).strict(),
  })
  .strict();

export const HallLibraryCoverUpdatedEventSchema = z
  .object({
    type: z.literal('hallLibrary.coverUpdated'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        itemType: z.enum(['tale', 'tune', 'television']),
        itemId: z.string().min(1),
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
        itemType: z.enum(['chapter', 'tuneTrack', 'televisionEpisode']),
        parentId: z.string().min(1),
        itemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

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

export const ChatAttachmentFinalizedEventSchema = z
  .object({
    type: z.literal('chat.attachmentFinalized'),
    ids: z
      .object({
        guildChatMessageId: z.string().min(1),
        conversationId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const FollowCreatedEventSchema = z
  .object({
    type: z.literal('follow.created'),
    ids: z
      .object({
        followerId: z.string().min(1),
        followedId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const FollowRemovedEventSchema = z
  .object({
    type: z.literal('follow.removed'),
    ids: z
      .object({
        followerId: z.string().min(1),
        followedId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const SquareStreetzPostLikedEventSchema = z
  .object({
    type: z.literal('squareStreetz.postLiked'),
    ids: z
      .object({
        userId: z.string().min(1),
        postId: z.string().min(1),
        authorId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const SquareStreetzPostUnlikedEventSchema = z
  .object({
    type: z.literal('squareStreetz.postUnliked'),
    ids: z
      .object({
        userId: z.string().min(1),
        postId: z.string().min(1),
        authorId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProfilePreferencesUpdatedEventSchema = z
  .object({
    type: z.literal('profile.preferencesUpdated'),
    ids: z
      .object({
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CraftSkillDeletedEventSchema = z
  .object({
    type: z.literal('craftSkill.deleted'),
    ids: z
      .object({
        userId: z.string().min(1),
        craftSkillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const CraftSkillUpdatedEventSchema = z
  .object({
    type: z.literal('craftSkill.updated'),
    ids: z
      .object({
        userId: z.string().min(1),
        craftSkillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

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

export const WorkProjectPublishedEventSchema = z
  .object({
    type: z.literal('workProject.published'),
    ids: z
      .object({
        workProjectId: z.string().min(1),
        userId: z.string().min(1),
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

export const CommissionDeletedEventSchema = z
  .object({
    type: z.literal('commission.deleted'),
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

export const ThresholdLibraryApprovedEventSchema = z
  .object({
    type: z.literal('thresholdLibrary.approved'),
    ids: z
      .object({
        thresholdItemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ThresholdLibraryRejectedEventSchema = z
  .object({
    type: z.literal('thresholdLibrary.rejected'),
    ids: z
      .object({
        thresholdItemId: z.string().min(1),
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
      })
      .strict(),
  })
  .strict();

export const HallLibraryPreferenceUpdatedEventSchema = z
  .object({
    type: z.literal('hallLibrary.preferenceUpdated'),
    ids: z
      .object({
        userId: z.string().min(1),
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

export const MentionReadEventSchema = z
  .object({
    type: z.literal('mention.read'),
    ids: z
      .object({
        userId: z.string().min(1),
        mentionId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const AuthStatusChangedEventSchema = z
  .object({
    type: z.literal('auth.statusChanged'),
    ids: z
      .object({
        userId: z.string().min(1),
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

export const DomainEventSchema = z.discriminatedUnion('type', [
  ProfilePictureUpdatedEventSchema,
  CraftSkillCreatedEventSchema,
  SquareStreetzPostCreatedEventSchema,
  AuditionPromptCreatedEventSchema,
  AuditionEntrySubmittedEventSchema,
  CommissionCreatedEventSchema,
  CommissionProposalSubmittedEventSchema,
  WorkProjectUpdatedEventSchema,
  HallLibraryCoverUpdatedEventSchema,
  HallLibrarySubItemUpdatedEventSchema,
  ModerationViolationCreatedEventSchema,
  ChatAttachmentFinalizedEventSchema,
  FollowCreatedEventSchema,
  FollowRemovedEventSchema,
  SquareStreetzPostLikedEventSchema,
  SquareStreetzPostUnlikedEventSchema,
  ProfilePreferencesUpdatedEventSchema,
  CraftSkillDeletedEventSchema,
  CraftSkillUpdatedEventSchema,
  WorkProjectCreatedEventSchema,
  WorkProjectPublishedEventSchema,
  WorkProjectStakeSharesUpdatedEventSchema,
  GuildInviteSentEventSchema,
  GuildInviteAcceptedEventSchema,
  GuildInviteDeclinedEventSchema,
  GuildInviteCancelledEventSchema,
  AuditionEntryVoteRecordedEventSchema,
  AuditionClosedEventSchema,
  CommissionDeletedEventSchema,
  CommissionProposalSavedEventSchema,
  CommissionProposalRemovedEventSchema,
  ThresholdLibrarySubmittedEventSchema,
  ThresholdLibraryApprovedEventSchema,
  ThresholdLibraryRejectedEventSchema,
  ThresholdLibraryNeedsRevisionEventSchema,
  HallLibraryPreferenceUpdatedEventSchema,
  AdminDispatchSystemMarkedEventSchema,
  AdminDispatchThreadUpdatedEventSchema,
  AdminAppealReviewedEventSchema,
  AdminDispatchReviewedEventSchema,
  MentionReadEventSchema,
  AuthStatusChangedEventSchema,
  ViolationAppealSubmittedEventSchema,
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;

// Helper for callers that need to extract the ids type for a specific
// event variant (e.g. registry entries in the consuming repo).
export type DomainEventIdsFor<T extends DomainEvent['type']> = Extract<
  DomainEvent,
  { type: T }
>['ids'];





