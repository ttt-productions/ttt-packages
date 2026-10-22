import { describe, it, expect } from 'vitest';
import {
  ACTIVE_LIMITS,
  APP_MODE,
  CHARTER_LIMITS,
  FULL_LIMITS,
  countCapReachedMessage,
} from '../src/constants/app-mode.js';
import {
  MAX_CONVERSATION_FILES,
  MAX_CONVERSATION_FILE_STORAGE_BYTES,
} from '../src/constants/conversation-files.js';
import { FullWorkProjectSchema } from '../src/doc-schemas/work-project.js';
import {
  GuildInviteConversationSchema,
  AdminDispatchSchema,
} from '../src/doc-schemas/messaging.js';
import { HALL_WING_TYPE_KEYS, WORK_PROJECT_TYPE_KEYS } from '../src/types/content.js';
import { GIB, MIB } from '../src/constants/byte-units.js';

describe('countCapReachedMessage — the one owner of cap copy', () => {
  it('charter mode names Charter Season and says caps expand later', () => {
    expect(APP_MODE).toBe('charter');
    expect(countCapReachedMessage('This project', 3, 'open auditions')).toBe(
      'This project already has the Charter Season maximum of 3 open auditions — caps expand when Charter Season ends.',
    );
  });

  it('appends the optional action hint as a trailing sentence', () => {
    expect(
      countCapReachedMessage('This conversation', 10, 'files', 'Delete a file to add another.'),
    ).toMatch(/ files — caps expand when Charter Season ends\. Delete a file to add another\.$/);
  });

  it('interpolates subject, limit, and noun without restating any canonical value', () => {
    const msg = countCapReachedMessage('This tale', 5, 'chapters');
    expect(msg).toContain('This tale');
    expect(msg).toContain('5 chapters');
  });
});

describe('storage caps in bytes', () => {
  it('Work-file storage is 2.5 GiB in charter mode and 25 GiB in full mode', () => {
    expect(CHARTER_LIMITS.workProject.maxWorkFileStorageBytes).toBe(2_684_354_560);
    expect(FULL_LIMITS.workProject.maxWorkFileStorageBytes).toBe(26_843_545_600);
  });

  it('Conversation Files storage is 500 MiB in charter mode and 1 GiB in full mode', () => {
    expect(CHARTER_LIMITS.conversation.maxConversationFileStorageBytes).toBe(524_288_000);
    expect(FULL_LIMITS.conversation.maxConversationFileStorageBytes).toBe(1_073_741_824);
  });
});

describe('Conversation Files quota per conversation', () => {
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

  it('the named constants derive from ACTIVE_LIMITS — one change point (RULE-STD-ENG-005)', () => {
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

  it('carries NO chat-attachment quota keys', () => {
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
    lastMessageAt: 1,
    awaitingAdminReply: true,
  };

  const COUNTER_FIELDS = [
    'conversationFileCount',
    'conversationFileBytesUsed',
    'conversationFileUploadCount',
    'conversationFileBytesReserved',
  ] as const;

  it('the Work project parses and carries no chat-attachment byte counter', () => {
    expect(FullWorkProjectSchema.safeParse(workProject).success).toBe(true);
    expect(Object.keys(FullWorkProjectSchema.shape)).not.toContain('chatAttachmentBytesUsed');
    expect(Object.keys(FullWorkProjectSchema.shape)).not.toContain('conversationFileBytesUsed');
  });

  it('GuildInviteConversation carries all four counters — absent parses, numbers parse, strings fail', () => {
    const parsed = GuildInviteConversationSchema.safeParse(invite);
    expect(parsed.success).toBe(true);
    for (const field of COUNTER_FIELDS) {
      expect(parsed.success && parsed.data[field]).toBeUndefined();
      expect(GuildInviteConversationSchema.safeParse({ ...invite, [field]: 1234 }).success).toBe(
        true,
      );
      expect(GuildInviteConversationSchema.safeParse({ ...invite, [field]: 'lots' }).success).toBe(
        false,
      );
    }
    expect(Object.keys(GuildInviteConversationSchema.shape)).not.toContain(
      'chatAttachmentBytesUsed',
    );
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
    expect(
      AdminDispatchSchema.safeParse({ ...dispatch, partyKind: 'workProject', workProjectId: 'wp1' })
        .success,
    ).toBe(true);
    expect(AdminDispatchSchema.safeParse({ ...dispatch, partyKind: 'guild' }).success).toBe(false);
  });
});

describe('guild invite conversation record', () => {
  it('declares no opening-message copy — the message lives only in the invite channel', () => {
    expect(Object.keys(GuildInviteConversationSchema.shape)).not.toContain('lastMessage');
    expect(Object.keys(GuildInviteConversationSchema.shape)).not.toContain('lastMessageAt');
  });
});
