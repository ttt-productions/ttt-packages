import { describe, it, expect } from 'vitest';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTIONS, USER_SUBCOLLECTIONS, PROJECT_SUBCOLLECTIONS, NESTED_SUBCOLLECTIONS, SPECIAL_DOCS } from '../src/paths/collections';

describe('PATH_BUILDERS', () => {
  // ===== USER PATHS =====
  describe('User Paths', () => {
    it('userProfile returns 2-segment tuple with correct collection', () => {
      const result = PATH_BUILDERS.userProfile('user123');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('user123');
    });

    it('userSkill returns 4-segment tuple with correct positions', () => {
      const result = PATH_BUILDERS.userSkill('userA', 'skillB');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('userA');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.PROFILE_SKILLS);
      expect(result[3]).toBe('skillB');
    });

    it('userPrivateData returns 4-segment tuple with userId as document ID', () => {
      const result = PATH_BUILDERS.userPrivateData('userA');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('userA');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.PRIVATE_DATA);
      expect(result[3]).toBe('userA');
    });

    it('userMetadata returns 4-segment tuple with notificationSettings doc', () => {
      const result = PATH_BUILDERS.userMetadata('userA');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('userA');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.USER_METADATA);
      expect(result[3]).toBe(SPECIAL_DOCS.NOTIFICATION_SETTINGS);
    });

    it('userFollow returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.userFollow('userA', 'followDocX');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('userA');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.USER_FOLLOWS);
      expect(result[3]).toBe('followDocX');
    });

    it('followedUser returns 6-segment tuple with nested history segments', () => {
      const result = PATH_BUILDERS.followedUser('userA', 'userB');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('userA');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.USER_FOLLOWS);
      expect(result[3]).toBe(NESTED_SUBCOLLECTIONS.FOLLOW_HISTORY);
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.FOLLOWED_USERS);
      expect(result[5]).toBe('userB');
    });

    it('userLike returns 6-segment tuple with nested like history segments', () => {
      const result = PATH_BUILDERS.userLike('userA', 'post1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('userA');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.USER_LIKES);
      expect(result[3]).toBe(NESTED_SUBCOLLECTIONS.LIKE_HISTORY);
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.STREETZ_LIKES);
      expect(result[5]).toBe('post1');
    });

    it('userDonation returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.userDonation('userA', 'don1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.USER_DONATIONS);
      expect(result[3]).toBe('don1');
    });

    it('userOpportunityVote returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.userOpportunityVote('userA', 'opp1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.OPPORTUNITY_VOTES);
      expect(result[3]).toBe('opp1');
    });
  });

  // ===== PROJECT PATHS =====
  describe('Project Paths', () => {
    it('project returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.project('proj1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[1]).toBe('proj1');
    });

    it('projectPublicData returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.projectPublicData('proj1', 'pub1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PUBLIC_DATA);
      expect(result[3]).toBe('pub1');
    });

    it('projectPost returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.projectPost('proj1', 'post1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_POSTS);
      expect(result[3]).toBe('post1');
    });

    it('projectTale returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.projectTale('proj1', 'tale1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TALES);
      expect(result[3]).toBe('tale1');
    });

    it('taleChapter returns 6-segment tuple', () => {
      const result = PATH_BUILDERS.taleChapter('proj1', 'tale1', 'chap1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TALES);
      expect(result[3]).toBe('tale1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.TALE_CHAPTERS);
      expect(result[5]).toBe('chap1');
    });

    it('projectTune returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.projectTune('proj1', 'tune1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TUNES);
      expect(result[3]).toBe('tune1');
    });

    it('tuneSong returns 6-segment tuple', () => {
      const result = PATH_BUILDERS.tuneSong('proj1', 'tune1', 'song1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TUNES);
      expect(result[3]).toBe('tune1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.TUNE_SONGS);
      expect(result[5]).toBe('song1');
    });

    it('projectTelevision returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.projectTelevision('proj1', 'tv1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TELEVISION);
      expect(result[3]).toBe('tv1');
    });

    it('tvShow returns 6-segment tuple', () => {
      const result = PATH_BUILDERS.tvShow('proj1', 'tv1', 'show1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.PROJECT_TELEVISION);
      expect(result[3]).toBe('tv1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.TV_SHOWS);
      expect(result[5]).toBe('show1');
    });

    it('projectShare returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.projectShare('proj1', 'share1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.SHARE_HISTORY);
      expect(result[3]).toBe('share1');
    });

    it('chatChannel returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.chatChannel('proj1', 'chan1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS);
      expect(result[3]).toBe('chan1');
    });

    it('channelMessage returns 6-segment tuple', () => {
      const result = PATH_BUILDERS.channelMessage('proj1', 'chan1', 'msg1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.ALL_PROJECTS);
      expect(result[2]).toBe(PROJECT_SUBCOLLECTIONS.CHAT_CHANNELS);
      expect(result[3]).toBe('chan1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.CHANNEL_MESSAGES);
      expect(result[5]).toBe('msg1');
    });
  });

  // ===== STREETZ PATHS =====
  describe('Streetz Paths', () => {
    it('pendingPost returns 4-segment tuple starting with streetzFeed', () => {
      const result = PATH_BUILDERS.pendingPost('post1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.STREETZ_FEED);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.PENDING_POSTS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.SOCIAL_POSTS);
      expect(result[3]).toBe('post1');
    });

    it('activePost returns 4-segment tuple starting with streetzFeed', () => {
      const result = PATH_BUILDERS.activePost('post1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.STREETZ_FEED);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.ACTIVE_POSTS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.SOCIAL_POSTS);
      expect(result[3]).toBe('post1');
    });

    it('trendingPosts returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.trendingPosts();
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.STREETZ_FEED);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.TRENDING_POSTS);
    });
  });

  // ===== LIBRARY PATHS =====
  describe('Library Paths', () => {
    it('pendingLibraryItem returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.pendingLibraryItem('lib1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.CONTENT_LIBRARY);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.PENDING_ITEMS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS);
      expect(result[3]).toBe('lib1');
    });

    it('publishedLibraryItem returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.publishedLibraryItem('lib1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.CONTENT_LIBRARY);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.PUBLISHED_ITEMS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS);
      expect(result[3]).toBe('lib1');
    });

    it('publishedLibraryItemType returns 6-segment tuple with projectType and itemId', () => {
      const result = PATH_BUILDERS.publishedLibraryItemType('lib1', 'Tales', 'item1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.CONTENT_LIBRARY);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.PUBLISHED_ITEMS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.LIBRARY_ITEMS);
      expect(result[3]).toBe('lib1');
      expect(result[4]).toBe('Tales');
      expect(result[5]).toBe('item1');
    });
  });

  // ===== JOB PATHS =====
  describe('Job Paths', () => {
    it('jobListing returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.jobListing('job1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.JOB_LISTINGS);
      expect(result[1]).toBe('job1');
    });

    it('jobApplication returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.jobApplication('job1', 'reply1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.JOB_LISTINGS);
      expect(result[1]).toBe('job1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.APPLICATION_REPLIES);
      expect(result[3]).toBe('reply1');
    });
  });

  // ===== OPPORTUNITY PATHS =====
  describe('Opportunity Paths', () => {
    it('opportunity returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.opportunity('opp1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.OPPORTUNITY_BOARD);
      expect(result[1]).toBe('opp1');
    });

    it('opportunityReply returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.opportunityReply('opp1', 'reply1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.OPPORTUNITY_BOARD);
      expect(result[1]).toBe('opp1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.SUBMITTED_REPLIES);
      expect(result[3]).toBe('reply1');
    });
  });

  // ===== UNIVERSE PATHS =====
  describe('Universe Paths', () => {
    it('universe returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.universe('uni1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.STORY_UNIVERSES);
      expect(result[1]).toBe('uni1');
    });
  });

  // ===== ADMIN & SYSTEM PATHS =====
  describe('Admin & System Paths', () => {
    it('adminMessage returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.adminMessage('msg1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PENDING_ADMIN_MESSAGES);
      expect(result[1]).toBe('msg1');
    });

    it('adminConversationMessage returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.adminConversationMessage('msg1', 'indivMsg1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.PENDING_ADMIN_MESSAGES);
      expect(result[1]).toBe('msg1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.CONVERSATION_MESSAGES);
      expect(result[3]).toBe('indivMsg1');
    });

    it('projectInvite returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.projectInvite('invite1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PROJECT_INVITE_CONVERSATIONS);
      expect(result[1]).toBe('invite1');
    });

    it('inviteMessage returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.inviteMessage('invite1', 'msg1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.PROJECT_INVITE_CONVERSATIONS);
      expect(result[1]).toBe('invite1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.INVITE_MESSAGES);
      expect(result[3]).toBe('msg1');
    });

    it('contentReport returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.contentReport('rep1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.CONTENT_REPORTS);
      expect(result[1]).toBe('rep1');
    });

    it('activeReportGroup returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.activeReportGroup('groupKey1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.ACTIVE_REPORT_GROUPS);
      expect(result[1]).toBe('groupKey1');
    });

    it('contentViolation returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.contentViolation('viol1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.CONTENT_VIOLATIONS);
      expect(result[1]).toBe('viol1');
    });

    it('adminTask returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.adminTask('task1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.ADMIN_TASKS);
      expect(result[1]).toBe('task1');
    });

    it('adminTaskForItem concatenates taskType and itemId with a dash', () => {
      const result = PATH_BUILDERS.adminTaskForItem('libraryReview', 'item123');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.ADMIN_TASKS);
      expect(result[1]).toBe('libraryReview-item123');
    });

    it('adminActivityLog returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.adminActivityLog('log1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.ADMIN_ACTIVITY_LOG);
      expect(result[1]).toBe('log1');
    });
  });

  // ===== UTILITY PATHS =====
  describe('Utility Paths', () => {
    it('reservedDisplayName returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.reservedDisplayName('JOHNDOE');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.RESERVED_DISPLAY_NAMES);
      expect(result[1]).toBe('JOHNDOE');
    });

    it('shortLink returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.shortLink('abc123');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.SHORT_LINKS);
      expect(result[1]).toBe('abc123');
    });

    it('pendingMedia returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.pendingMedia('media1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PENDING_MEDIA);
      expect(result[1]).toBe('media1');
    });

    it('notificationQueue returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.notificationQueue('notif1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.NOTIFICATION_QUEUE);
      expect(result[1]).toBe('notif1');
    });

    it('donationsSummary returns 2-segment tuple with SUMMARY special doc', () => {
      const result = PATH_BUILDERS.donationsSummary();
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.DONATIONS_SUMMARY);
      expect(result[1]).toBe(SPECIAL_DOCS.SUMMARY);
    });

    it('recentDonation returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.recentDonation('don1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.RECENT_DONATIONS);
      expect(result[1]).toBe('don1');
    });

    it('archivedDonation returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.archivedDonation('don1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.ARCHIVED_DONATIONS);
      expect(result[1]).toBe('don1');
    });
  });

  // ===== FEEDBACK & SKILLS PATHS =====
  describe('Feedback & Skills Paths', () => {
    it('feedbackSubmission returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.feedbackSubmission('bug');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.FEEDBACK_SUBMISSIONS);
      expect(result[1]).toBe('bug');
    });

    it('userSuggestion returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.userSuggestion('bug', 'sug1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.FEEDBACK_SUBMISSIONS);
      expect(result[1]).toBe('bug');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.USER_SUGGESTIONS);
      expect(result[3]).toBe('sug1');
    });

    it('feedbackAlias returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.feedbackAlias('alias1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.FEEDBACK_ALIASES);
      expect(result[1]).toBe('alias1');
    });

    it('feedbackDenylist returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.feedbackDenylist('badword');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.FEEDBACK_DENYLIST);
      expect(result[1]).toBe('badword');
    });

    it('taggedSkill returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.taggedSkill('photography', 'compositeId1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.SKILLS_BY_TAG);
      expect(result[1]).toBe('photography');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.TAGGED_SKILLS);
      expect(result[3]).toBe('compositeId1');
    });
  });

  // ===== SYSTEM DATA PATHS =====
  describe('System Data Paths', () => {
    it('adminList returns 2-segment tuple with ADMIN_LIST special doc', () => {
      const result = PATH_BUILDERS.adminList();
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.SYSTEM_DATA);
      expect(result[1]).toBe(SPECIAL_DOCS.ADMIN_LIST);
    });

    it('futurePlans returns 2-segment tuple with FUTURE_PLANS special doc', () => {
      const result = PATH_BUILDERS.futurePlans();
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.SYSTEM_DATA);
      expect(result[1]).toBe(SPECIAL_DOCS.FUTURE_PLANS);
    });

    it('rulesAndAgreements returns 2-segment tuple with RULES_AND_AGREEMENTS special doc', () => {
      const result = PATH_BUILDERS.rulesAndAgreements();
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.SYSTEM_DATA);
      expect(result[1]).toBe(SPECIAL_DOCS.RULES_AND_AGREEMENTS);
    });
  });
});
