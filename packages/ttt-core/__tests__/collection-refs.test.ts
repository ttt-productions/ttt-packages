import { describe, it, expect } from 'vitest';
import { COLLECTION_REFS } from '../src/paths/collection-refs';
import { COLLECTIONS, USER_SUBCOLLECTIONS, WORK_PROJECT_SUBCOLLECTIONS, NESTED_SUBCOLLECTIONS } from '../src/paths/collections';

describe('COLLECTION_REFS', () => {
  describe('Top-level collection refs', () => {
    it('userProfiles returns single-element tuple', () => {
      const result = COLLECTION_REFS.userProfiles();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
    });

    it('allWorkProjects returns single-element tuple', () => {
      const result = COLLECTION_REFS.allWorkProjects();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
    });

    it('workRealms returns single-element tuple', () => {
      const result = COLLECTION_REFS.workRealms();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.WORK_REALMS);
    });

    it('squareStreetzFeed returns single-element tuple', () => {
      const result = COLLECTION_REFS.squareStreetzFeed();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.SQUARE_STREETZ_FEED);
    });

    it('thresholdItems returns single-element tuple', () => {
      const result = COLLECTION_REFS.thresholdItems();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.THRESHOLD_ITEMS);
    });

    it('hallItems returns single-element tuple', () => {
      const result = COLLECTION_REFS.hallItems();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.HALL_ITEMS);
    });

    it('commissionListings returns single-element tuple', () => {
      const result = COLLECTION_REFS.commissionListings();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.COMMISSION_LISTINGS);
    });

    it('auditionBoard returns single-element tuple', () => {
      const result = COLLECTION_REFS.auditionBoard();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.AUDITION_BOARD);
    });
  });

  describe('User subcollection refs', () => {
    it('userCraftSkills returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.userCraftSkills('user1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('user1');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.PROFILE_CRAFT_SKILLS);
    });
  });

  describe('WorkProject subcollection refs', () => {
    it('workProjectTales returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.workProjectTales('proj1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES);
    });

    it('workProjectTunes returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.workProjectTunes('proj1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES);
    });

    it('workProjectTelevision returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.workProjectTelevision('proj1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION);
    });

    it('guildChatChannels returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.guildChatChannels('proj1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.GUILD_CHAT_CHANNELS);
    });

    it('tuneTracks returns 5-segment tuple', () => {
      const result = COLLECTION_REFS.tuneTracks('proj1', 'tune1');
      expect(result).toHaveLength(5);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[1]).toBe('proj1');
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES);
      expect(result[3]).toBe('tune1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.TUNE_TRACKS);
    });
  });

  describe('SquareStreetz collection refs', () => {
    it('activePosts returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.activePosts();
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.SQUARE_STREETZ_FEED);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.ACTIVE_POSTS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.SOCIAL_POSTS);
    });
  });

  describe('Commission & Audition collection refs', () => {
    it('commissionProposals returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.commissionProposals('job1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.COMMISSION_LISTINGS);
      expect(result[1]).toBe('job1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.COMMISSION_PROPOSALS);
    });

    it('auditionEntries returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.auditionEntries('opp1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.AUDITION_BOARD);
      expect(result[1]).toBe('opp1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.AUDITION_ENTRIES);
    });
  });
});



