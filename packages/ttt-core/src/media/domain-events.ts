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

export const SkillCreatedEventSchema = z
  .object({
    type: z.literal('craftSkill.created'),
    ids: z
      .object({
        userId: z.string().min(1),
        skillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const StreetzPostCreatedEventSchema = z
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

export const OpportunityPromptCreatedEventSchema = z
  .object({
    type: z.literal('audition.promptCreated'),
    ids: z
      .object({
        userId: z.string().min(1),
        opportunityId: z.string().min(1),
        projectId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const OpportunityReplyCreatedEventSchema = z
  .object({
    type: z.literal('audition.replyCreated'),
    ids: z
      .object({
        userId: z.string().min(1),
        opportunityId: z.string().min(1),
        replyId: z.string().min(1),
        projectId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const JobCreatedEventSchema = z
  .object({
    type: z.literal('commission.created'),
    ids: z
      .object({
        userId: z.string().min(1),
        jobId: z.string().min(1),
        projectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const JobApplicationSubmittedEventSchema = z
  .object({
    type: z.literal('commission.applicationSubmitted'),
    ids: z
      .object({
        userId: z.string().min(1),
        jobId: z.string().min(1),
        projectId: z.string().min(1),
        applicationId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProjectUpdatedEventSchema = z
  .object({
    type: z.literal('workProject.updated'),
    ids: z.object({ projectId: z.string().min(1) }).strict(),
  })
  .strict();

export const LibraryAssetCoverUpdatedEventSchema = z
  .object({
    type: z.literal('libraryAsset.coverUpdated'),
    ids: z
      .object({
        projectId: z.string().min(1),
        itemType: z.enum(['tale', 'tune', 'television']),
        itemId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const LibraryAssetSubItemUpdatedEventSchema = z
  .object({
    type: z.literal('libraryAsset.subItemUpdated'),
    ids: z
      .object({
        projectId: z.string().min(1),
        itemType: z.enum(['chapter', 'song', 'show']),
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
        messageId: z.string().min(1),
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

export const StreetzPostLikedEventSchema = z
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

export const StreetzPostUnlikedEventSchema = z
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

export const SkillDeletedEventSchema = z
  .object({
    type: z.literal('craftSkill.deleted'),
    ids: z
      .object({
        userId: z.string().min(1),
        skillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const SkillUpdatedEventSchema = z
  .object({
    type: z.literal('craftSkill.updated'),
    ids: z
      .object({
        userId: z.string().min(1),
        skillId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProjectCreatedEventSchema = z
  .object({
    type: z.literal('workProject.created'),
    ids: z
      .object({
        userId: z.string().min(1),
        projectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProjectPublishedEventSchema = z
  .object({
    type: z.literal('workProject.published'),
    ids: z
      .object({
        projectId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProjectSharesUpdatedEventSchema = z
  .object({
    type: z.literal('workProject.sharesUpdated'),
    ids: z
      .object({
        projectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProjectInviteSentEventSchema = z
  .object({
    type: z.literal('workProject.inviteSent'),
    ids: z
      .object({
        projectId: z.string().min(1),
        inviteId: z.string().min(1),
        inviterId: z.string().min(1),
        inviteeId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProjectInviteAcceptedEventSchema = z
  .object({
    type: z.literal('workProject.inviteAccepted'),
    ids: z
      .object({
        projectId: z.string().min(1),
        inviteId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProjectInviteDeclinedEventSchema = z
  .object({
    type: z.literal('workProject.inviteDeclined'),
    ids: z
      .object({
        projectId: z.string().min(1),
        inviteId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const ProjectInviteCancelledEventSchema = z
  .object({
    type: z.literal('workProject.inviteCancelled'),
    ids: z
      .object({
        projectId: z.string().min(1),
        inviteId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const OpportunityReplyVotedEventSchema = z
  .object({
    type: z.literal('audition.replyVoted'),
    ids: z
      .object({
        userId: z.string().min(1),
        opportunityId: z.string().min(1),
        replyId: z.string().min(1),
        projectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const OpportunityClosedEventSchema = z
  .object({
    type: z.literal('audition.closed'),
    ids: z
      .object({
        opportunityId: z.string().min(1),
        projectId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

export const JobDeletedEventSchema = z
  .object({
    type: z.literal('commission.deleted'),
    ids: z
      .object({
        jobId: z.string().min(1),
        projectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const JobApplicationSavedEventSchema = z
  .object({
    type: z.literal('commission.applicationSaved'),
    ids: z
      .object({
        jobId: z.string().min(1),
        applicationId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const JobApplicationRemovedEventSchema = z
  .object({
    type: z.literal('commission.applicationRemoved'),
    ids: z
      .object({
        jobId: z.string().min(1),
        applicationId: z.string().min(1),
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const LibraryAssetSubmittedEventSchema = z
  .object({
    type: z.literal('libraryAsset.submitted'),
    ids: z
      .object({
        projectId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const LibraryAssetApprovedEventSchema = z
  .object({
    type: z.literal('libraryAsset.approved'),
    ids: z
      .object({
        libraryId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const LibraryAssetRejectedEventSchema = z
  .object({
    type: z.literal('libraryAsset.rejected'),
    ids: z
      .object({
        libraryId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const LibraryAssetNeedsRevisionEventSchema = z
  .object({
    type: z.literal('libraryAsset.needsRevision'),
    ids: z
      .object({
        libraryId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const LibraryAssetPreferenceUpdatedEventSchema = z
  .object({
    type: z.literal('libraryAsset.preferenceUpdated'),
    ids: z
      .object({
        userId: z.string().min(1),
        libraryId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const MessageSystemMarkedEventSchema = z
  .object({
    type: z.literal('message.systemMarked'),
    ids: z
      .object({
        userId: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const MessageAdminThreadUpdatedEventSchema = z
  .object({
    type: z.literal('message.adminThreadUpdated'),
    ids: z
      .object({
        messageId: z.string().min(1).nullable(),
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

export const AdminSystemMessageReviewedEventSchema = z
  .object({
    type: z.literal('admin.systemMessageReviewed'),
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
  SkillCreatedEventSchema,
  StreetzPostCreatedEventSchema,
  OpportunityPromptCreatedEventSchema,
  OpportunityReplyCreatedEventSchema,
  JobCreatedEventSchema,
  JobApplicationSubmittedEventSchema,
  ProjectUpdatedEventSchema,
  LibraryAssetCoverUpdatedEventSchema,
  LibraryAssetSubItemUpdatedEventSchema,
  ModerationViolationCreatedEventSchema,
  ChatAttachmentFinalizedEventSchema,
  FollowCreatedEventSchema,
  FollowRemovedEventSchema,
  StreetzPostLikedEventSchema,
  StreetzPostUnlikedEventSchema,
  ProfilePreferencesUpdatedEventSchema,
  SkillDeletedEventSchema,
  SkillUpdatedEventSchema,
  ProjectCreatedEventSchema,
  ProjectPublishedEventSchema,
  ProjectSharesUpdatedEventSchema,
  ProjectInviteSentEventSchema,
  ProjectInviteAcceptedEventSchema,
  ProjectInviteDeclinedEventSchema,
  ProjectInviteCancelledEventSchema,
  OpportunityReplyVotedEventSchema,
  OpportunityClosedEventSchema,
  JobDeletedEventSchema,
  JobApplicationSavedEventSchema,
  JobApplicationRemovedEventSchema,
  LibraryAssetSubmittedEventSchema,
  LibraryAssetApprovedEventSchema,
  LibraryAssetRejectedEventSchema,
  LibraryAssetNeedsRevisionEventSchema,
  LibraryAssetPreferenceUpdatedEventSchema,
  MessageSystemMarkedEventSchema,
  MessageAdminThreadUpdatedEventSchema,
  AdminAppealReviewedEventSchema,
  AdminSystemMessageReviewedEventSchema,
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
