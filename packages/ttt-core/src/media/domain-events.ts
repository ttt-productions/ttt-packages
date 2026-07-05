import { z } from "zod";
import {
  ProfilePictureUpdatedEventSchema,
  ProfilePreferencesUpdatedEventSchema,
  CraftSkillCreatedEventSchema,
  CraftSkillUpdatedEventSchema,
  CraftSkillDeletedEventSchema,
  FollowCreatedEventSchema,
  FollowRemovedEventSchema,
  MentionReadEventSchema,
  AuthStatusChangedEventSchema,
} from "./domain-events-user.js";
import {
  WorkProjectCreatedEventSchema,
  WorkProjectUpdatedEventSchema,
  WorkProjectPublishedEventSchema,
  WorkProjectStakeSharesUpdatedEventSchema,
  GuildInviteSentEventSchema,
  GuildInviteAcceptedEventSchema,
  GuildInviteDeclinedEventSchema,
  GuildInviteCancelledEventSchema,
  AuditionPromptCreatedEventSchema,
  AuditionEntrySubmittedEventSchema,
  AuditionEntryVoteRecordedEventSchema,
  AuditionClosedEventSchema,
  CommissionCreatedEventSchema,
  CommissionProposalSubmittedEventSchema,
  CommissionDeletedEventSchema,
  CommissionProposalSavedEventSchema,
  CommissionProposalRemovedEventSchema,
  HallLibraryCoverUpdatedEventSchema,
  HallLibrarySubItemUpdatedEventSchema,
  ThresholdLibrarySubmittedEventSchema,
} from "./domain-events-work.js";
import {
  SquareStreetzPostCreatedEventSchema,
  SquareStreetzPostLikedEventSchema,
  SquareStreetzPostUnlikedEventSchema,
  ChatAttachmentFinalizedEventSchema,
} from "./domain-events-social.js";
import {
  ModerationViolationCreatedEventSchema,
  ThresholdLibraryApprovedEventSchema,
  ThresholdLibraryRejectedEventSchema,
  ThresholdLibraryNeedsRevisionEventSchema,
  AdminDispatchSystemMarkedEventSchema,
  AdminDispatchThreadUpdatedEventSchema,
  AdminAppealReviewedEventSchema,
  AdminDispatchReviewedEventSchema,
  ViolationAppealSubmittedEventSchema,
} from "./domain-events-admin.js";

export * from "./domain-events-user.js";
export * from "./domain-events-work.js";
export * from "./domain-events-social.js";
export * from "./domain-events-admin.js";

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





