// Collection reference builders — for collection-level operations.
//
// Frontend: collection(db, ...COLLECTION_REFS.userProfiles())
// Backend:  db.collection(toPath(COLLECTION_REFS.userProfiles()))

import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  PROJECT_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
} from './collections.js';

export const COLLECTION_REFS = {
  // Top-level collections
  userProfiles: (): [string] => [COLLECTIONS.USER_PROFILES],
  allWorkProjects: (): [string] => [COLLECTIONS.ALL_PROJECTS],
  workRealms: (): [string] => [COLLECTIONS.STORY_UNIVERSES],
  squareStreetzFeed: (): [string] => [COLLECTIONS.STREETZ_FEED],
  commissionListings: (): [string] => [COLLECTIONS.JOB_LISTINGS],
  auditionBoard: (): [string] => [COLLECTIONS.OPPORTUNITY_BOARD],

  // User subcollections
  userSkills: (userId: string): [string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.PROFILE_SKILLS],

  userFollows: (userId: string): [string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_FOLLOWS],

  // WorkProject subcollections
  projectTales: (projectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TALES],

  projectTunes: (projectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TUNES],

  projectTelevision: (projectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TELEVISION],

  guildChatChannels: (projectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS],

  guildChatMessages: (projectId: string, channelId: string): [string, string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS, channelId, NESTED_SUBCOLLECTIONS.CHANNEL_MESSAGES],

  // SquareStreetz collections
  activePosts: (): [string, string, string] =>
    [COLLECTIONS.STREETZ_FEED, NESTED_SUBCOLLECTIONS.ACTIVE_POSTS, NESTED_SUBCOLLECTIONS.SOCIAL_POSTS],

  // HallLibrary collections
  thresholdItems: (): [string] => [COLLECTIONS.THRESHOLD_ITEMS],

  hallItems: (): [string] => [COLLECTIONS.HALL_ITEMS],

  // Commission/Audition collections
  commissionProposals: (jobId: string): [string, string, string] =>
    [COLLECTIONS.JOB_LISTINGS, jobId, NESTED_SUBCOLLECTIONS.APPLICATION_REPLIES],

  auditionEntries: (opportunityId: string): [string, string, string] =>
    [COLLECTIONS.OPPORTUNITY_BOARD, opportunityId, NESTED_SUBCOLLECTIONS.SUBMITTED_REPLIES],

  tuneTracks: (projectId: string, tuneId: string): readonly [string, string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TUNES, tuneId, NESTED_SUBCOLLECTIONS.TUNE_SONGS] as const,
} as const;
