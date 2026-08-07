import { describe, it, expect } from 'vitest';
import {
  ACTIVE_LIMITS,
  APP_MODE,
  CHARTER_LIMITS,
  FULL_LIMITS,
  countCapReachedMessage,
} from '../src/constants/app-mode';
import {
  MAX_CONVERSATION_FILES,
  MAX_CONVERSATION_FILE_STORAGE_BYTES,
} from '../src/constants/conversation-files';
import { FullWorkProjectSchema } from '../src/doc-schemas/work-project';
import { GuildInviteConversationSchema, AdminDispatchSchema } from '../src/doc-schemas/messaging';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../src/types/content';

const GIB = 1024 * 1024 * 1024;
const MIB = 1024 * 1024;

describe('app-mode rate-limit buckets', () => {
  it('admin uploads have the ruled values (60/h charter, 120/h full — DJ ruling 2026-07-25)', () => {
    expect(CHARTER_LIMITS.rateLimits.ADMIN_UPLOAD).toEqual({ maxRequests: 60, window: '1 h' });
    expect(FULL_LIMITS.rateLimits.ADMIN_UPLOAD).toEqual({ maxRequests: 120, window: '1 h' });
  });

  it('ADMIN_UPLOAD is a HIGHER bucket than UPLOAD in every mode — never an exemption', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS]) {
      const { UPLOAD, ADMIN_UPLOAD } = limits.rateLimits;
      expect(ADMIN_UPLOAD.window).toBe(UPLOAD.window);
      expect(ADMIN_UPLOAD.maxRequests).toBeGreaterThan(UPLOAD.maxRequests);
      expect(Number.isFinite(ADMIN_UPLOAD.maxRequests)).toBe(true);
    }
  });

  it('non-upload content writes have the ruled values (30/h charter, 60/h full — DJ ruling 2026-07-25)', () => {
    expect(CHARTER_LIMITS.rateLimits.CONTENT_WRITE).toEqual({ maxRequests: 30, window: '1 h' });
    expect(FULL_LIMITS.rateLimits.CONTENT_WRITE).toEqual({ maxRequests: 60, window: '1 h' });
  });

  it('CONTENT_WRITE is its own bucket on the UPLOAD window — text writes never consume the upload ceiling', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS]) {
      const { UPLOAD, CONTENT_WRITE } = limits.rateLimits;
      expect(CONTENT_WRITE.window).toBe(UPLOAD.window);
      expect(Number.isFinite(CONTENT_WRITE.maxRequests)).toBe(true);
      expect(CONTENT_WRITE.maxRequests).toBeGreaterThan(0);
    }
  });
});

// BACKEND-013 — every named surface carries a DELIBERATE rate-limit decision, in a bucket that
// names its own surface. These three were the gaps: createMediaGrant borrowed MENTION_HISTORY,
// mintChatGrant had no limiter at all, and the operator step-up TOTP was unthrottled.
describe('grant-minting and operator step-up buckets (BACKEND-013)', () => {
  it('grant minting has its OWN buckets — never MENTION_HISTORY, never absent', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS]) {
      const { MEDIA_GRANT, CHAT_GRANT } = limits.rateLimits;
      for (const bucket of [MEDIA_GRANT, CHAT_GRANT]) {
        expect(Number.isFinite(bucket.maxRequests)).toBe(true);
        expect(bucket.maxRequests).toBeGreaterThan(0);
      }
    }
  });

  it('the two grant surfaces are paced alike, so neither starves the other', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS]) {
      expect(limits.rateLimits.CHAT_GRANT).toEqual(limits.rateLimits.MEDIA_GRANT);
    }
  });

  it('grant buckets scale at the full-mode flip and never tighten', () => {
    expect(CHARTER_LIMITS.rateLimits.MEDIA_GRANT).toEqual({ maxRequests: 120, window: '1 h' });
    expect(FULL_LIMITS.rateLimits.MEDIA_GRANT).toEqual({ maxRequests: 240, window: '1 h' });
    expect(FULL_LIMITS.rateLimits.CHAT_GRANT.maxRequests).toBeGreaterThanOrEqual(
      CHARTER_LIMITS.rateLimits.CHAT_GRANT.maxRequests,
    );
  });

  it('OPERATOR_STEP_UP is tighter than every admin bucket it guards — a brute-force brake', () => {
    // The second factor protecting the safety console must be harder to hammer than any of the
    // admin actions it unlocks, and tighter than the general sensitive-action budget the finding
    // proposed reusing (SENSITIVE_ACTION would have allowed 30-60 guesses an hour).
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS]) {
      const { OPERATOR_STEP_UP, SENSITIVE_ACTION, ADMIN_TASK, MODERATION, BAN_ACTION, APPEAL_REVIEW } =
        limits.rateLimits;
      expect(OPERATOR_STEP_UP).toEqual({ maxRequests: 10, window: '1 h' });
      for (const guarded of [SENSITIVE_ACTION, ADMIN_TASK, MODERATION, BAN_ACTION, APPEAL_REVIEW]) {
        expect(guarded.window).toBe(OPERATOR_STEP_UP.window);
        expect(OPERATOR_STEP_UP.maxRequests).toBeLessThan(guarded.maxRequests);
      }
    }
  });

  it('OPERATOR_STEP_UP is mode-INVARIANT — a security control never loosens at the flip', () => {
    expect(FULL_LIMITS.rateLimits.OPERATOR_STEP_UP).toEqual(CHARTER_LIMITS.rateLimits.OPERATOR_STEP_UP);
  });
});

describe('countCapReachedMessage — the one owner of cap copy', () => {
  it('charter mode names Charter Season and says caps expand later', () => {
    // APP_MODE is compile-time 'charter' today; this asserts the deployed copy.
    expect(APP_MODE).toBe('charter');
    expect(countCapReachedMessage('This project', 3, 'open auditions')).toBe(
      'This project already has the Charter Season maximum of 3 open auditions — caps expand when Charter Season ends.',
    );
  });

  it('appends the optional action hint as a trailing sentence', () => {
    expect(countCapReachedMessage('This conversation', 10, 'files', 'Delete a file to add another.')).toMatch(
      / files — caps expand when Charter Season ends\. Delete a file to add another\.$/,
    );
  });

  it('interpolates subject, limit, and noun without restating any canonical value', () => {
    const msg = countCapReachedMessage('This tale', 5, 'chapters');
    expect(msg).toContain('This tale');
    expect(msg).toContain('5 chapters');
  });
});

describe('Conversation Files quota per conversation (DJ ruling 2026-07-25)', () => {
  it('has the ruled values — charter 10 files / 500 MiB, full 20 files / 1 GiB', () => {
    expect(CHARTER_LIMITS.conversation.maxConversationFiles).toBe(10);
    expect(CHARTER_LIMITS.conversation.maxConversationFileStorageBytes).toBe(500 * MIB);
    expect(FULL_LIMITS.conversation.maxConversationFiles).toBe(20);
    expect(FULL_LIMITS.conversation.maxConversationFileStorageBytes).toBe(1 * GIB);
  });

  it('full is never SMALLER than charter — the flip only ever raises a ceiling', () => {
    expect(FULL_LIMITS.conversation.maxConversationFiles).toBeGreaterThanOrEqual(
      CHARTER_LIMITS.conversation.maxConversationFiles,
    );
    expect(FULL_LIMITS.conversation.maxConversationFileStorageBytes).toBeGreaterThanOrEqual(
      CHARTER_LIMITS.conversation.maxConversationFileStorageBytes,
    );
  });

  it('the named constants derive from ACTIVE_LIMITS — one change point (ENG-005)', () => {
    expect(MAX_CONVERSATION_FILES).toBe(ACTIVE_LIMITS.conversation.maxConversationFiles);
    expect(MAX_CONVERSATION_FILE_STORAGE_BYTES).toBe(
      ACTIVE_LIMITS.conversation.maxConversationFileStorageBytes,
    );
  });

  it('is its OWN container quota — never the work-file storage cap', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS]) {
      expect(limits.conversation.maxConversationFileStorageBytes).not.toBe(
        limits.workProject.maxWorkFileStorageBytes,
      );
    }
  });

  it('carries NO removed chat-attachment quota keys', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS]) {
      expect(Object.keys(limits.workProject)).not.toContain('maxChatAttachmentStorageBytes');
      expect(Object.keys(limits)).not.toContain('guildInvite');
    }
  });
});

describe('Conversation Files usage counters (absent ⇒ 0)', () => {
  const workProject = {
    workProjectId: 'wp1',
    createdOn: 1,
    type: WORK_PROJECT_TYPE_KEYS[0],
    workingDescription: 'd',
    workingTitle: 't',
    hallWingType: HALL_WING_TYPE_KEYS[0],
    createdBy: { uid: 'u1' },
    status: 'open' as const,
    workRealmId: 'r1',
    realmCanonStatus: 'canon' as const,
  };

  const invite = {
    guildInviteId: 'gi1',
    workProjectId: 'wp1',
    relatedUserIds: ['u1', 'u2'],
    workProject: { workProjectId: 'wp1', type: WORK_PROJECT_TYPE_KEYS[0] },
    createdBy: { uid: 'u1' },
    sender: { uid: 'u1' },
    recipient: { uid: 'u2' },
    stakeSharesOffered: 10,
    source: { type: 'standalone' as const },
    status: 'pending' as const,
    createdAt: 1,
    updatedAt: 1,
    lastUpdatedAt: 1,
    senderConfirmed: false,
    recipientConfirmed: false,
  };

  const dispatch = {
    adminDispatchId: 'ad1',
    partyKind: 'user' as const,
    userId: 'u1',
    initiatorUserId: 'u1',
    initiatedBy: 'user' as const,
    subject: 's',
    status: 'open' as const,
    createdAt: 1,
    lastUpdatedAt: 1,
    readByAdmin: false,
    readByUser: true,
  };

  const COUNTER_FIELDS = [
    'conversationFileCount',
    'conversationFileBytesUsed',
    'conversationFileUploadCount',
    'conversationFileBytesReserved',
  ] as const;

  it('the Work project parses and no longer carries a chat-attachment byte counter', () => {
    expect(FullWorkProjectSchema.safeParse(workProject).success).toBe(true);
    expect(Object.keys(FullWorkProjectSchema.shape)).not.toContain('chatAttachmentBytesUsed');
    // Conversation Files are quota'd per CONVERSATION, never on the Work.
    expect(Object.keys(FullWorkProjectSchema.shape)).not.toContain('conversationFileBytesUsed');
  });

  it('GuildInviteConversation carries all four counters — absent parses, numbers parse, strings fail', () => {
    const parsed = GuildInviteConversationSchema.safeParse(invite);
    expect(parsed.success).toBe(true);
    for (const field of COUNTER_FIELDS) {
      expect(parsed.success && parsed.data[field]).toBeUndefined();
      expect(GuildInviteConversationSchema.safeParse({ ...invite, [field]: 1234 }).success).toBe(true);
      expect(GuildInviteConversationSchema.safeParse({ ...invite, [field]: 'lots' }).success).toBe(false);
    }
    expect(Object.keys(GuildInviteConversationSchema.shape)).not.toContain('chatAttachmentBytesUsed');
  });

  it('AdminDispatch carries the same four counters — one counter contract per conversation parent', () => {
    const parsed = AdminDispatchSchema.safeParse(dispatch);
    expect(parsed.success).toBe(true);
    for (const field of COUNTER_FIELDS) {
      expect(parsed.success && parsed.data[field]).toBeUndefined();
      expect(AdminDispatchSchema.safeParse({ ...dispatch, [field]: 1234 }).success).toBe(true);
      expect(AdminDispatchSchema.safeParse({ ...dispatch, [field]: 'lots' }).success).toBe(false);
    }
  });

  it('AdminDispatch partyKind is REQUIRED — the personal-threads query and party-aware rules depend on it', () => {
    const { partyKind: _partyKind, ...withoutParty } = dispatch;
    expect(AdminDispatchSchema.safeParse(withoutParty).success).toBe(false);
    expect(AdminDispatchSchema.safeParse({ ...dispatch, partyKind: 'workProject', workProjectId: 'wp1' }).success).toBe(true);
    expect(AdminDispatchSchema.safeParse({ ...dispatch, partyKind: 'guild' }).success).toBe(false);
  });
});
