import { describe, it, expect } from 'vitest';
import { ACTIVE_LIMITS, CHARTER_LIMITS, FULL_LIMITS } from '../src/constants/app-mode';
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
});
