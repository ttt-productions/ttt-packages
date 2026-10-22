import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  WORK_PROJECT_SUBCOLLECTIONS,
  WORK_REALM_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
} from './collections.js';
import type { PublicDocumentId } from '../constants/public-documents.js';

export const COLLECTION_REFS = {
  userProfiles: (): [string] => [COLLECTIONS.USER_PROFILES],
  allWorkProjects: (): [string] => [COLLECTIONS.ALL_WORK_PROJECTS],
  publicWorkProjects: (): [string] => [COLLECTIONS.PUBLIC_WORK_PROJECTS],
  workRealms: (): [string] => [COLLECTIONS.WORK_REALMS],
  squareStreetzFeed: (): [string] => [COLLECTIONS.SQUARE_STREETZ_FEED],
  commissionListings: (): [string] => [COLLECTIONS.COMMISSION_LISTINGS],
  auditionBoard: (): [string] => [COLLECTIONS.AUDITION_BOARD],
  followEdges: (): [string] => [COLLECTIONS.FOLLOW_EDGES],
  followCounters: (): [string] => [COLLECTIONS.FOLLOW_COUNTERS],

  activeUserNotifications: (): [string] => [COLLECTIONS.ACTIVE_USER_NOTIFICATIONS],
  activeAdminNotifications: (): [string] => [COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS],

  userCraftSkills: (userId: string): [string, string, string] => [
    COLLECTIONS.USER_PROFILES,
    userId,
    USER_SUBCOLLECTIONS.PROFILE_CRAFT_SKILLS,
  ],

  workProjectTales: (workProjectId: string): [string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES,
  ],

  workProjectTunes: (workProjectId: string): [string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES,
  ],

  workProjectTelevision: (workProjectId: string): [string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION,
  ],

  workProjectPublicGuildmateUsers: (workProjectId: string): [string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.PUBLIC_GUILDMATE_USERS,
  ],

  guildChatChannels: (workProjectId: string): [string, string, string] => [
    COLLECTIONS.ALL_WORK_PROJECTS,
    workProjectId,
    WORK_PROJECT_SUBCOLLECTIONS.GUILD_CHAT_CHANNELS,
  ],

  realmFileFolders: (workRealmId: string): [string, string, string] => [
    COLLECTIONS.WORK_REALMS,
    workRealmId,
    WORK_REALM_SUBCOLLECTIONS.REALM_FILE_FOLDERS,
  ],

  activePosts: (): [string, string, string] => [
    COLLECTIONS.SQUARE_STREETZ_FEED,
    NESTED_SUBCOLLECTIONS.ACTIVE_POSTS,
    NESTED_SUBCOLLECTIONS.SOCIAL_POSTS,
  ],

  thresholdItems: (): [string] => [COLLECTIONS.THRESHOLD_ITEMS],

  hallItems: (): [string] => [COLLECTIONS.HALL_ITEMS],

  hallContentChangeRequests: (): [string] => [COLLECTIONS.HALL_CONTENT_CHANGE_REQUESTS],

  commissionProposals: (commissionListingId: string): [string, string, string] => [
    COLLECTIONS.COMMISSION_LISTINGS,
    commissionListingId,
    NESTED_SUBCOLLECTIONS.COMMISSION_PROPOSALS,
  ],

  auditionEntries: (auditionId: string): [string, string, string] => [
    COLLECTIONS.AUDITION_BOARD,
    auditionId,
    NESTED_SUBCOLLECTIONS.AUDITION_ENTRIES,
  ],

  tuneTracks: (
    workProjectId: string,
    tuneId: string,
  ): readonly [string, string, string, string, string] =>
    [
      COLLECTIONS.ALL_WORK_PROJECTS,
      workProjectId,
      WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES,
      tuneId,
      NESTED_SUBCOLLECTIONS.TUNE_TRACKS,
    ] as const,

  moderationCascadeChangedDocs: (cascadeId: string): [string, string, string] => [
    COLLECTIONS.MODERATION_CASCADE_MANIFESTS,
    cascadeId,
    NESTED_SUBCOLLECTIONS.CHANGED_DOCS,
  ],

  guildInviteConversationFiles: (guildInviteId: string): [string, string, string] => [
    COLLECTIONS.GUILD_INVITE_CONVERSATIONS,
    guildInviteId,
    NESTED_SUBCOLLECTIONS.CONVERSATION_FILES,
  ],

  adminDispatchConversationFiles: (adminDispatchId: string): [string, string, string] => [
    COLLECTIONS.PENDING_ADMIN_DISPATCHES,
    adminDispatchId,
    NESTED_SUBCOLLECTIONS.CONVERSATION_FILES,
  ],

  adminDispatchReadMarkers: (adminDispatchId: string): [string, string, string] => [
    COLLECTIONS.PENDING_ADMIN_DISPATCHES,
    adminDispatchId,
    NESTED_SUBCOLLECTIONS.DISPATCH_READ_MARKERS,
  ],

  adminDispatchConversationMessages: (adminDispatchId: string): [string, string, string] => [
    COLLECTIONS.PENDING_ADMIN_DISPATCHES,
    adminDispatchId,
    NESTED_SUBCOLLECTIONS.CONVERSATION_MESSAGES,
  ],

  userSuggestions: (feedbackType: string): [string, string, string] => [
    COLLECTIONS.FEEDBACK_SUBMISSIONS,
    feedbackType,
    NESTED_SUBCOLLECTIONS.USER_SUGGESTIONS,
  ],

  pendingMedia: (): [string] => [COLLECTIONS.PENDING_MEDIA],

  pendingMediaArchive: (): [string] => [COLLECTIONS.PENDING_MEDIA_ARCHIVE],

  mediaCopyIntents: (): [string] => [COLLECTIONS.MEDIA_COPY_INTENTS],

  publicDocumentVersions: (documentId: PublicDocumentId): [string, string, string] => [
    COLLECTIONS.PUBLIC_DOCUMENTS,
    documentId,
    NESTED_SUBCOLLECTIONS.PUBLIC_DOCUMENT_VERSIONS,
  ],
} as const;
