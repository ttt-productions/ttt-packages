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
    type: z.literal('skill.created'),
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
    type: z.literal('streetz.postCreated'),
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
    type: z.literal('opportunity.promptCreated'),
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
    type: z.literal('opportunity.replyCreated'),
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
    type: z.literal('job.created'),
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
    type: z.literal('job.applicationSubmitted'),
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

export const DomainEventSchema = z.discriminatedUnion('type', [
  ProfilePictureUpdatedEventSchema,
  SkillCreatedEventSchema,
  StreetzPostCreatedEventSchema,
  OpportunityPromptCreatedEventSchema,
  OpportunityReplyCreatedEventSchema,
  JobCreatedEventSchema,
  JobApplicationSubmittedEventSchema,
  LibraryAssetCoverUpdatedEventSchema,
  LibraryAssetSubItemUpdatedEventSchema,
  ModerationViolationCreatedEventSchema,
  ChatAttachmentFinalizedEventSchema,
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;

// Helper for callers that need to extract the ids type for a specific
// event variant (e.g. registry entries in the consuming repo).
export type DomainEventIdsFor<T extends DomainEvent['type']> = Extract<
  DomainEvent,
  { type: T }
>['ids'];
