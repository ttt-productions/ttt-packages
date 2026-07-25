import { describe, it, expect } from 'vitest';
import { ACTIVE_LIMITS, CHARTER_LIMITS, FULL_LIMITS } from '../src/constants/app-mode';
import {
  MAX_WORK_CHAT_ATTACHMENT_STORAGE_BYTES,
  MAX_INVITE_THREAD_CHAT_ATTACHMENT_STORAGE_BYTES,
} from '../src/constants/chat';
import { FullWorkProjectSchema } from '../src/doc-schemas/work-project';
import { GuildInviteConversationSchema } from '../src/doc-schemas/messaging';
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

describe('chat-attachment storage quota per container (DJ ruling 2026-07-25)', () => {
  it('per-Work quota has the ruled values (2 GiB charter, 10 GiB full)', () => {
    expect(CHARTER_LIMITS.workProject.maxChatAttachmentStorageBytes).toBe(2 * GIB);
    expect(FULL_LIMITS.workProject.maxChatAttachmentStorageBytes).toBe(10 * GIB);
  });

  it('per-invite-thread quota is 250 MiB in BOTH modes — an invite is not longer at full-live', () => {
    expect(CHARTER_LIMITS.guildInvite.maxChatAttachmentStorageBytes).toBe(250 * MIB);
    expect(FULL_LIMITS.guildInvite.maxChatAttachmentStorageBytes).toBe(250 * MIB);
  });

  it('full is never SMALLER than charter for the Work quota — the flip only ever raises a ceiling', () => {
    expect(FULL_LIMITS.workProject.maxChatAttachmentStorageBytes).toBeGreaterThanOrEqual(
      CHARTER_LIMITS.workProject.maxChatAttachmentStorageBytes,
    );
    expect(FULL_LIMITS.guildInvite.maxChatAttachmentStorageBytes).toBeGreaterThanOrEqual(
      CHARTER_LIMITS.guildInvite.maxChatAttachmentStorageBytes,
    );
  });

  it('an invite thread is capped far below a Work — it is a 1:1 negotiation, not a collaboration container', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS, ACTIVE_LIMITS]) {
      expect(limits.guildInvite.maxChatAttachmentStorageBytes).toBeLessThan(
        limits.workProject.maxChatAttachmentStorageBytes,
      );
    }
  });

  it('the named constants derive from ACTIVE_LIMITS — one change point (ENG-005)', () => {
    expect(MAX_WORK_CHAT_ATTACHMENT_STORAGE_BYTES).toBe(
      ACTIVE_LIMITS.workProject.maxChatAttachmentStorageBytes,
    );
    expect(MAX_INVITE_THREAD_CHAT_ATTACHMENT_STORAGE_BYTES).toBe(
      ACTIVE_LIMITS.guildInvite.maxChatAttachmentStorageBytes,
    );
  });

  it('chat-attachment storage is its OWN container quota — never the work-file storage cap', () => {
    for (const limits of [CHARTER_LIMITS, FULL_LIMITS]) {
      expect(limits.workProject.maxChatAttachmentStorageBytes).not.toBe(
        limits.workProject.maxWorkFileStorageBytes,
      );
    }
  });
});

describe('chat-attachment usage counters (absent ⇒ 0)', () => {
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

  it('FullWorkProject parses with the counter absent and with a number present', () => {
    const parsed = FullWorkProjectSchema.safeParse(workProject);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.chatAttachmentBytesUsed).toBeUndefined();
    expect(
      FullWorkProjectSchema.safeParse({ ...workProject, chatAttachmentBytesUsed: 1234 }).success,
    ).toBe(true);
    expect(
      FullWorkProjectSchema.safeParse({ ...workProject, chatAttachmentBytesUsed: 'lots' }).success,
    ).toBe(false);
  });

  it('GuildInviteConversation parses with the counter absent and with a number present', () => {
    const parsed = GuildInviteConversationSchema.safeParse(invite);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.chatAttachmentBytesUsed).toBeUndefined();
    expect(
      GuildInviteConversationSchema.safeParse({ ...invite, chatAttachmentBytesUsed: 1234 }).success,
    ).toBe(true);
    expect(
      GuildInviteConversationSchema.safeParse({ ...invite, chatAttachmentBytesUsed: 'lots' }).success,
    ).toBe(false);
  });
});
