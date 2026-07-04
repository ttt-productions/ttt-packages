// Collection reference builders — for collection-level operations.
//
// Frontend: collection(db, ...COLLECTION_REFS.userProfiles())
// Backend:  db.collection(toPath(COLLECTION_REFS.userProfiles()))

import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  WORK_PROJECT_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
} from './collections.js';

export const COLLECTION_REFS = {
  // Top-level collections
  userProfiles: (): [string] => [COLLECTIONS.USER_PROFILES],
  allWorkProjects: (): [string] => [COLLECTIONS.ALL_WORK_PROJECTS],
  publicWorkProjects: (): [string] => [COLLECTIONS.PUBLIC_WORK_PROJECTS],
  workRealms: (): [string] => [COLLECTIONS.WORK_REALMS],
  squareStreetzFeed: (): [string] => [COLLECTIONS.SQUARE_STREETZ_FEED],
  commissionListings: (): [string] => [COLLECTIONS.COMMISSION_LISTINGS],
  auditionBoard: (): [string] => [COLLECTIONS.AUDITION_BOARD],
  followEdges: (): [string] => [COLLECTIONS.FOLLOW_EDGES],
  followCounters: (): [string] => [COLLECTIONS.FOLLOW_COUNTERS],

  // User subcollections
  userCraftSkills: (userId: string): [string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.PROFILE_CRAFT_SKILLS],

  // WorkProject subcollections
  workProjectTales: (workProjectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES],

  workProjectTunes: (workProjectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES],

  workProjectTelevision: (workProjectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION],

  workProjectPublicGuildmateUsers: (workProjectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.PUBLIC_GUILDMATE_USERS],

  guildChatChannels: (workProjectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.GUILD_CHAT_CHANNELS],

  // SquareStreetz collections
  activePosts: (): [string, string, string] =>
    [COLLECTIONS.SQUARE_STREETZ_FEED, NESTED_SUBCOLLECTIONS.ACTIVE_POSTS, NESTED_SUBCOLLECTIONS.SOCIAL_POSTS],

  // HallLibrary collections
  thresholdItems: (): [string] => [COLLECTIONS.THRESHOLD_ITEMS],

  hallItems: (): [string] => [COLLECTIONS.HALL_ITEMS],

  hallContentChangeRequests: (): [string] => [COLLECTIONS.HALL_CONTENT_CHANGE_REQUESTS],

  // Commission/Audition collections
  commissionProposals: (commissionListingId: string): [string, string, string] =>
    [COLLECTIONS.COMMISSION_LISTINGS, commissionListingId, NESTED_SUBCOLLECTIONS.COMMISSION_PROPOSALS],

  auditionEntries: (auditionId: string): [string, string, string] =>
    [COLLECTIONS.AUDITION_BOARD, auditionId, NESTED_SUBCOLLECTIONS.AUDITION_ENTRIES],

  tuneTracks: (workProjectId: string, tuneId: string): readonly [string, string, string, string, string] =>
    [COLLECTIONS.ALL_WORK_PROJECTS, workProjectId, WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES, tuneId, NESTED_SUBCOLLECTIONS.TUNE_TRACKS] as const,

  moderationCascadeChangedDocs: (cascadeId: string): [string, string, string] =>
    [COLLECTIONS.MODERATION_CASCADE_MANIFESTS, cascadeId, NESTED_SUBCOLLECTIONS.CHANGED_DOCS],
} as const;
