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
  allProjects: (): [string] => [COLLECTIONS.ALL_PROJECTS],
  storyUniverses: (): [string] => [COLLECTIONS.STORY_UNIVERSES],
  streetzFeed: (): [string] => [COLLECTIONS.STREETZ_FEED],
  contentLibrary: (): [string] => [COLLECTIONS.CONTENT_LIBRARY],
  jobListings: (): [string] => [COLLECTIONS.JOB_LISTINGS],
  opportunityBoard: (): [string] => [COLLECTIONS.OPPORTUNITY_BOARD],

  // User subcollections
  userSkills: (userId: string): [string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.PROFILE_SKILLS],

  userFollows: (userId: string): [string, string, string] =>
    [COLLECTIONS.USER_PROFILES, userId, USER_SUBCOLLECTIONS.USER_FOLLOWS],

  // Project subcollections
  projectTales: (projectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TALES],

  projectTunes: (projectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TUNES],

  projectTelevision: (projectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TELEVISION],

  chatChannels: (projectId: string): [string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS],

  channelMessages: (projectId: string, channelId: string): [string, string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS, channelId, NESTED_SUBCOLLECTIONS.CHANNEL_MESSAGES],

  // Streetz collections
  pendingPosts: (): [string, string, string] =>
    [COLLECTIONS.STREETZ_FEED, NESTED_SUBCOLLECTIONS.PENDING_POSTS, NESTED_SUBCOLLECTIONS.SOCIAL_POSTS],

  activePosts: (): [string, string, string] =>
    [COLLECTIONS.STREETZ_FEED, NESTED_SUBCOLLECTIONS.ACTIVE_POSTS, NESTED_SUBCOLLECTIONS.SOCIAL_POSTS],

  // Library collections
  pendingLibraryItems: (): [string, string, string] =>
    [COLLECTIONS.CONTENT_LIBRARY, NESTED_SUBCOLLECTIONS.PENDING_ITEMS, NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS],

  publishedLibraryItems: (): [string, string, string] =>
    [COLLECTIONS.CONTENT_LIBRARY, NESTED_SUBCOLLECTIONS.PUBLISHED_ITEMS, NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS],

  // Job/Opportunity collections
  jobApplications: (jobId: string): [string, string, string] =>
    [COLLECTIONS.JOB_LISTINGS, jobId, NESTED_SUBCOLLECTIONS.APPLICATION_REPLIES],

  opportunityReplies: (opportunityId: string): [string, string, string] =>
    [COLLECTIONS.OPPORTUNITY_BOARD, opportunityId, NESTED_SUBCOLLECTIONS.SUBMITTED_REPLIES],

  tuneSongs: (projectId: string, tuneId: string): readonly [string, string, string, string, string] =>
    [COLLECTIONS.ALL_PROJECTS, projectId, PROJECT_SUBCOLLECTIONS.PROJECT_TUNES, tuneId, NESTED_SUBCOLLECTIONS.TUNE_SONGS] as const,
} as const;
