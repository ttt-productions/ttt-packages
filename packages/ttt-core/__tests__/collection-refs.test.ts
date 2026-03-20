import { describe, it, expect } from 'vitest';
import { COLLECTION_REFS } from '../src/paths/collection-refs';
import { COLLECTIONS, USER_SUBCOLLECTIONS, PROJECT_SUBCOLLECTIONS, NESTED_SUBCOLLECTIONS } from '../src/paths/collections';

describe('COLLECTION_REFS', () => {
  describe('Top-level collection refs', () => {
    it('userProfiles returns single-element tuple', () => {
      const result = COLLECTION_REFS.userProfiles();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
    });

    it('allProjects returns single-element tuple', () => {
      const result = COLLECTION_REFS.allProjects();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
    });

    it('storyUniverses returns single-element tuple', () => {
      const result = COLLECTION_REFS.storyUniverses();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.STORY_UNIVERSES);
    });

    it('streetzFeed returns single-element tuple', () => {
      const result = COLLECTION_REFS.streetzFeed();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.STREETZ_FEED);
    });

    it('contentLibrary returns single-element tuple', () => {
      const result = COLLECTION_REFS.contentLibrary();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.CONTENT_LIBRARY);
    });

    it('jobListings returns single-element tuple', () => {
      const result = COLLECTION_REFS.jobListings();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.JOB_LISTINGS);
    });

    it('opportunityBoard returns single-element tuple', () => {
      const result = COLLECTION_REFS.opportunityBoard();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.OPPORTUNITY_BOARD);
    });
  });

  describe('User subcollection refs', () => {
    it('userSkills returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.userSkills('user1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('user1');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.PROFILE_SKILLS);
    });

    it('userFollows returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.userFollows('user1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('user1');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.USER_FOLLOWS);
    });
  });

  describe('Project subcollection refs', () => {
    it('projectTales returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.projectTales('proj1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TALES);
    });

    it('projectTunes returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.projectTunes('proj1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TUNES);
    });

    it('projectTelevision returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.projectTelevision('proj1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TELEVISION);
    });

    it('chatChannels returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.chatChannels('proj1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS);
    });

    it('channelMessages returns 5-segment tuple', () => {
      const result = COLLECTION_REFS.channelMessages('proj1', 'chan1');
      expect(result).toHaveLength(5);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS);
      expect(result[3]).toBe('chan1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.CHANNEL_MESSAGES);
    });

    it('tuneSongs returns 5-segment tuple', () => {
      const result = COLLECTION_REFS.tuneSongs('proj1', 'tune1');
      expect(result).toHaveLength(5);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TUNES);
      expect(result[3]).toBe('tune1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.TUNE_SONGS);
    });
  });

  describe('Streetz collection refs', () => {
    it('pendingPosts returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.pendingPosts();
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.STREETZ_FEED);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.PENDING_POSTS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.SOCIAL_POSTS);
    });

    it('activePosts returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.activePosts();
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.STREETZ_FEED);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.ACTIVE_POSTS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.SOCIAL_POSTS);
    });
  });

  describe('Library collection refs', () => {
    it('pendingLibraryItems returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.pendingLibraryItems();
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.CONTENT_LIBRARY);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.PENDING_ITEMS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS);
    });

    it('publishedLibraryItems returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.publishedLibraryItems();
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.CONTENT_LIBRARY);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.PUBLISHED_ITEMS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS);
    });
  });

  describe('Job & Opportunity collection refs', () => {
    it('jobApplications returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.jobApplications('job1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.JOB_LISTINGS);
      expect(result[1]).toBe('job1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.APPLICATION_REPLIES);
    });

    it('opportunityReplies returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.opportunityReplies('opp1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.OPPORTUNITY_BOARD);
      expect(result[1]).toBe('opp1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.SUBMITTED_REPLIES);
    });
  });
});
