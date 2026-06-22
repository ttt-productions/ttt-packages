import { describe, it, expect } from 'vitest';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTIONS, USER_SUBCOLLECTIONS, WORK_PROJECT_SUBCOLLECTIONS, NESTED_SUBCOLLECTIONS, SPECIAL_DOCS } from '../src/paths/collections';

describe('PATH_BUILDERS', () => {
  // ===== USER PATHS =====
  describe('User Paths', () => {
    it('userProfile returns 2-segment tuple with correct collection', () => {
      const result = PATH_BUILDERS.userProfile('user123');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('user123');
    });

    it('userCraftSkill returns 4-segment tuple with correct positions', () => {
      const result = PATH_BUILDERS.userCraftSkill('userA', 'craftSkillB');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('userA');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.PROFILE_CRAFT_SKILLS);
      expect(result[3]).toBe('craftSkillB');
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

    it('followEdge returns a 2-segment tuple with a deterministic composite id', () => {
      const result = PATH_BUILDERS.followEdge('userA', 'workProject', 'wp1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.FOLLOW_EDGES);
      expect(result[1]).toBe('userA__workProject__wp1');
    });

    it('workProjectPublicGuildmateUser returns a 4-segment tuple', () => {
      const result = PATH_BUILDERS.workProjectPublicGuildmateUser('wp1', 'userB');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[1]).toBe('wp1');
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.PUBLIC_GUILDMATE_USERS);
      expect(result[3]).toBe('userB');
    });

    it('userLike returns 6-segment tuple with nested like history segments', () => {
      const result = PATH_BUILDERS.userLike('userA', 'post1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[1]).toBe('userA');
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.USER_LIKES);
      expect(result[3]).toBe(NESTED_SUBCOLLECTIONS.LIKE_HISTORY);
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.SQUARE_STREETZ_LIKES);
      expect(result[5]).toBe('post1');
    });

    it('userAuditionVote returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.userAuditionVote('userA', 'opp1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.USER_PROFILES);
      expect(result[2]).toBe(USER_SUBCOLLECTIONS.AUDITION_VOTES);
      expect(result[3]).toBe('opp1');
    });
  });

  // ===== WORK PATHS =====
  describe('WorkWORK PATHS', () => {
    it('workProject returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.workProject('proj1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[1]).toBe('proj1');
    });

    it('publicWorkProject returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.publicWorkProject('wp1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PUBLIC_WORK_PROJECTS);
      expect(result[1]).toBe('wp1');
    });

    it('workProjectTale returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.workProjectTale('proj1', 'tale1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES);
      expect(result[3]).toBe('tale1');
    });

    it('taleChapter returns 6-segment tuple', () => {
      const result = PATH_BUILDERS.taleChapter('proj1', 'tale1', 'chap1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TALES);
      expect(result[3]).toBe('tale1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.TALE_CHAPTERS);
      expect(result[5]).toBe('chap1');
    });

    it('workProjectTune returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.workProjectTune('proj1', 'tune1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES);
      expect(result[3]).toBe('tune1');
    });

    it('tuneTrack returns 6-segment tuple', () => {
      const result = PATH_BUILDERS.tuneTrack('proj1', 'tune1', 'song1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TUNES);
      expect(result[3]).toBe('tune1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.TUNE_TRACKS);
      expect(result[5]).toBe('song1');
    });

    it('workProjectTelevision returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.workProjectTelevision('proj1', 'tv1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION);
      expect(result[3]).toBe('tv1');
    });

    it('televisionEpisode returns 6-segment tuple', () => {
      const result = PATH_BUILDERS.televisionEpisode('proj1', 'tv1', 'show1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_PROJECT_TELEVISION);
      expect(result[3]).toBe('tv1');
      expect(result[4]).toBe(NESTED_SUBCOLLECTIONS.TELEVISION_EPISODES);
      expect(result[5]).toBe('show1');
    });

    it('workProjectGuildmateUser returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.workProjectGuildmateUser('proj1', 'uid1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.GUILDMATE_USERS);
      expect(result[3]).toBe('uid1');
    });

    it('workFileFolder returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.workFileFolder('proj1', 'folder1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_FILE_FOLDERS);
      expect(result[3]).toBe('folder1');
    });

    it('workFile returns 6-segment tuple nested under its folder', () => {
      const result = PATH_BUILDERS.workFile('proj1', 'folder1', 'file1');
      expect(result).toHaveLength(6);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.WORK_FILE_FOLDERS);
      expect(result[3]).toBe('folder1');
      expect(result[5]).toBe('file1');
    });

    it('guildChatChannel returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.guildChatChannel('proj1', 'chan1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.ALL_WORK_PROJECTS);
      expect(result[2]).toBe(WORK_PROJECT_SUBCOLLECTIONS.GUILD_CHAT_CHANNELS);
      expect(result[3]).toBe('chan1');
    });

  });

  // ===== SQUARE PATHS =====
  describe('SquareSQUARE PATHS', () => {
    it('activePost returns 4-segment tuple starting with squareStreetzFeed', () => {
      const result = PATH_BUILDERS.activePost('post1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.SQUARE_STREETZ_FEED);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.ACTIVE_POSTS);
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.SOCIAL_POSTS);
      expect(result[3]).toBe('post1');
    });

    it('trendingPosts returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.trendingPosts();
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.SQUARE_STREETZ_FEED);
      expect(result[1]).toBe(NESTED_SUBCOLLECTIONS.TRENDING_POSTS);
    });
  });

  // ===== HALL PATHS =====
  describe('HallHALL PATHS', () => {
    it('thresholdItem returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.thresholdItem('lib1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.THRESHOLD_ITEMS);
      expect(result[1]).toBe('lib1');
    });

    it('hallItem returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.hallItem('lib1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.HALL_ITEMS);
      expect(result[1]).toBe('lib1');
    });

    it('hallItemType returns 4-segment tuple with workProjectType and itemId', () => {
      const result = PATH_BUILDERS.hallItemType('lib1', 'Tales', 'item1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.HALL_ITEMS);
      expect(result[1]).toBe('lib1');
      expect(result[2]).toBe('Tales');
      expect(result[3]).toBe('item1');
    });
  });

  // ===== COMMISSION PATHS =====
  describe('Commission Paths', () => {
    it('commissionListing returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.commissionListing('job1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.COMMISSION_LISTINGS);
      expect(result[1]).toBe('job1');
    });

    it('commissionProposal returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.commissionProposal('job1', 'reply1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.COMMISSION_LISTINGS);
      expect(result[1]).toBe('job1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.COMMISSION_PROPOSALS);
      expect(result[3]).toBe('reply1');
    });
  });

  // ===== AUDITION PATHS =====
  describe('Audition Paths', () => {
    it('audition returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.audition('opp1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.AUDITION_BOARD);
      expect(result[1]).toBe('opp1');
    });

    it('auditionEntry returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.auditionEntry('opp1', 'reply1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.AUDITION_BOARD);
      expect(result[1]).toBe('opp1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.AUDITION_ENTRIES);
      expect(result[3]).toBe('reply1');
    });
  });

  // ===== REALM PATHS =====
  describe('WorkRealm Paths', () => {
    it('workRealm returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.workRealm('uni1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.WORK_REALMS);
      expect(result[1]).toBe('uni1');
    });
  });

  describe('Moderation Cascade Paths', () => {
    it('moderationCascadeManifest returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.moderationCascadeManifest('casc1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.MODERATION_CASCADE_MANIFESTS);
      expect(result[1]).toBe('casc1');
    });

    it('moderationCascadeChangedDoc returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.moderationCascadeChangedDoc('casc1', 'chg1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.MODERATION_CASCADE_MANIFESTS);
      expect(result[1]).toBe('casc1');
      expect(result[3]).toBe('chg1');
    });
  });

  // ===== ADMIN & SYSTEM PATHS =====
  describe('Admin & System Paths', () => {
    it('adminDispatch returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.adminDispatch('msg1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PENDING_ADMIN_DISPATCHES);
      expect(result[1]).toBe('msg1');
    });

    it('adminConversationMessage returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.adminConversationMessage('msg1', 'indivMsg1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.PENDING_ADMIN_DISPATCHES);
      expect(result[1]).toBe('msg1');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.CONVERSATION_MESSAGES);
      expect(result[3]).toBe('indivMsg1');
    });

    it('guildInvite returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.guildInvite('invite1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.GUILD_INVITE_CONVERSATIONS);
      expect(result[1]).toBe('invite1');
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
      const result = PATH_BUILDERS.adminTaskForItem('thresholdLibraryReview', 'item123');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.ADMIN_TASKS);
      expect(result[1]).toBe('thresholdLibraryReview-item123');
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

    it('pendingMediaArchive returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.pendingMediaArchive('pma_123');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PENDING_MEDIA_ARCHIVE);
      expect(result[1]).toBe('pma_123');
    });

  });

  // ===== PAYMENT & PLEDGE PATHS =====
  describe('Payment & Pledge Paths', () => {
    it('pledgePayment returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.pledgePayment('pp1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PLEDGE_PAYMENTS);
      expect(result[1]).toBe('pp1');
    });

    it('pledgePaymentProviderRef returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.pledgePaymentProviderRef('pp1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PLEDGE_PAYMENT_PROVIDER_REFS);
      expect(result[1]).toBe('pp1');
    });

    it('processedStripeEvent returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.processedStripeEvent('evt_123');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PROCESSED_STRIPE_EVENTS);
      expect(result[1]).toBe('evt_123');
    });

    it('pledgePaymentLedgerEvent returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.pledgePaymentLedgerEvent('ledger1');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PLEDGE_PAYMENT_LEDGER_EVENTS);
      expect(result[1]).toBe('ledger1');
    });

    it('paymentWebhookQuarantine returns 2-segment tuple', () => {
      const result = PATH_BUILDERS.paymentWebhookQuarantine('evt_123');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.PAYMENT_WEBHOOK_QUARANTINE);
      expect(result[1]).toBe('evt_123');
    });
  });

  // ===== FEEDBACK & CRAFT PATHS =====
  describe('FEEDBACK & CRAFT PATHS', () => {
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

    it('taggedCraftSkill returns 4-segment tuple', () => {
      const result = PATH_BUILDERS.taggedCraftSkill('photography', 'compositeId1');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe(COLLECTIONS.CRAFT_SKILLS_BY_TAG);
      expect(result[1]).toBe('photography');
      expect(result[2]).toBe(NESTED_SUBCOLLECTIONS.TAGGED_CRAFT_SKILLS);
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
      expect(result[0]).toBe(COLLECTIONS.APP_CONFIG);
      expect(result[1]).toBe(SPECIAL_DOCS.FUTURE_PLANS);
    });

    it('profanityList returns 2-segment tuple with PROFANITY_LIST special doc', () => {
      const result = PATH_BUILDERS.profanityList();
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.SYSTEM_DATA);
      expect(result[1]).toBe(SPECIAL_DOCS.PROFANITY_LIST);
    });

    it('rulesAndAgreements returns 2-segment tuple with RULES_AND_AGREEMENTS special doc', () => {
      const result = PATH_BUILDERS.rulesAndAgreements();
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(COLLECTIONS.APP_CONFIG);
      expect(result[1]).toBe(SPECIAL_DOCS.RULES_AND_AGREEMENTS);
    });
  });
});





