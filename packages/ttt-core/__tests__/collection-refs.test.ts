import { describe, it, expect } from 'vitest';
import { COLLECTION_REFS } from '../src/paths/collection-refs';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { toPath } from '../src/paths/utils';
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

    it('active notification lanes return the canonical category collections', () => {
      expect(COLLECTION_REFS.activeUserNotifications()).toEqual([COLLECTIONS.ACTIVE_USER_NOTIFICATIONS]);
      expect(COLLECTION_REFS.activeAdminNotifications()).toEqual([COLLECTIONS.ACTIVE_ADMIN_NOTIFICATIONS]);
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

  describe('Conversation collection refs', () => {
    it('adminDispatchConversationMessages returns 3-segment tuple', () => {
      const result = COLLECTION_REFS.adminDispatchConversationMessages('ad1');
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(COLLECTIONS.PENDING_ADMIN_DISPATCHES);
      expect(result[1]).toBe('ad1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.CONVERSATION_MESSAGES);
    });

    it('adminDispatchConversationMessages is the parent collection of adminConversationMessage', () => {
      // The auto-id mint (`collection(...).doc()`) and the per-document builder must address
      // the same collection — a divergence would write messages a thread never reads.
      expect(toPath(COLLECTION_REFS.adminDispatchConversationMessages('ad1'))).toBe(
        'pendingAdminDispatches/ad1/conversationMessages',
      );
      expect(toPath(PATH_BUILDERS.adminConversationMessage('ad1', 'msg1'))).toBe(
        `${toPath(COLLECTION_REFS.adminDispatchConversationMessages('ad1'))}/msg1`,
      );
    });

    it('adminDispatchConversationFiles stays the files collection, not the messages one', () => {
      expect(toPath(COLLECTION_REFS.adminDispatchConversationFiles('ad1'))).toBe(
        'pendingAdminDispatches/ad1/conversationFiles',
      );
    });
  });

  describe('Media pipeline collection refs', () => {
    it('pendingMedia returns single-element tuple', () => {
      const result = COLLECTION_REFS.pendingMedia();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.PENDING_MEDIA);
    });

    it('pendingMediaArchive returns single-element tuple', () => {
      const result = COLLECTION_REFS.pendingMediaArchive();
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(COLLECTIONS.PENDING_MEDIA_ARCHIVE);
    });

    it('mediaCopyIntents returns single-element tuple', () => {
      expect(COLLECTION_REFS.mediaCopyIntents()).toEqual([COLLECTIONS.MEDIA_COPY_INTENTS]);
    });

    it('both are the parent collections of their per-document builders', () => {
      // The sweep reads and writes these as collections while the processors address single
      // rows — a divergence would archive into a collection nothing reads.
      expect(toPath(PATH_BUILDERS.pendingMedia('pm1'))).toBe(
        `${toPath(COLLECTION_REFS.pendingMedia())}/pm1`,
      );
      expect(toPath(PATH_BUILDERS.pendingMediaArchive('pm1'))).toBe(
        `${toPath(COLLECTION_REFS.pendingMediaArchive())}/pm1`,
      );
    });
  });
});



