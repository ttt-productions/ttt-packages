import { describe, it, expect } from 'vitest';
import {
  AdminCreateMediaGrantInputSchema,
  CreateMediaGrantInputSchema,
  CreateMediaGrantResultSchema,
} from '../src/schemas/media.js';
import { ChatGrantInputSchema } from '../src/schemas/chat.js';
import { ResumeFanoutJobInputSchema } from '../src/schemas/notification.js';

// Client-called callable input schemas: every callable's input lives in ttt-core/schemas.

describe('CreateMediaGrantInputSchema (media grant wire contract)', () => {
  it('accepts each scopeKind variant', () => {
    expect(CreateMediaGrantInputSchema.parse({ scopeKind: 'workProject', workProjectId: 'wp1' }).scopeKind).toBe('workProject');
    expect(
      CreateMediaGrantInputSchema.parse({ scopeKind: 'workFileFolder', workProjectId: 'wp1', workFileFolderId: 'f1' }).scopeKind,
    ).toBe('workFileFolder');
    expect(
      CreateMediaGrantInputSchema.parse({ scopeKind: 'commissionProposal', commissionListingId: 'c1', commissionProposalId: 'p1' }).scopeKind,
    ).toBe('commissionProposal');
    expect(CreateMediaGrantInputSchema.parse({ scopeKind: 'guildInvite', guildInviteId: 'gi1' }).scopeKind).toBe('guildInvite');
    expect(CreateMediaGrantInputSchema.parse({ scopeKind: 'adminSupport', adminDispatchId: 'ad1' }).scopeKind).toBe('adminSupport');
  });

  it('rejects an unknown scopeKind', () => {
    expect(() => CreateMediaGrantInputSchema.parse({ scopeKind: 'wholeWork', workProjectId: 'wp1' })).toThrow();
  });

  it('rejects a guildChannel scope — guild channels have no Conversation Files', () => {
    expect(() =>
      CreateMediaGrantInputSchema.parse({ scopeKind: 'guildChannel', workProjectId: 'wp1', guildChatChannelId: 'ch1' }),
    ).toThrow();
  });

  it('is strict — a workFileFolder scope must not omit the folder id or carry extra keys', () => {
    expect(() => CreateMediaGrantInputSchema.parse({ scopeKind: 'workFileFolder', workProjectId: 'wp1' })).toThrow();
    expect(() =>
      CreateMediaGrantInputSchema.parse({ scopeKind: 'guildInvite', guildInviteId: 'gi1', extra: 'x' }),
    ).toThrow();
  });
});

describe('the admin grant is a callable of its own', () => {
  const review = { scopeKind: 'adminReview', reportGroupId: 'rg1', mediaAssetId: 'a1' };

  it('a participant grant never takes the admin-only review scope', () => {
    expect(CreateMediaGrantInputSchema.safeParse(review).success).toBe(false);
  });

  it('the admin grant takes the review, Work, and support-thread scopes', () => {
    expect(AdminCreateMediaGrantInputSchema.safeParse(review).success).toBe(true);
    expect(AdminCreateMediaGrantInputSchema.safeParse({ scopeKind: 'workProject', workProjectId: 'wp1' }).success).toBe(true);
    expect(AdminCreateMediaGrantInputSchema.safeParse({ scopeKind: 'adminSupport', adminDispatchId: 'ad1' }).success).toBe(true);
  });

  it('the admin grant takes no participant-only scope', () => {
    expect(AdminCreateMediaGrantInputSchema.safeParse({ scopeKind: 'guildInvite', guildInviteId: 'gi1' }).success).toBe(false);
    expect(
      AdminCreateMediaGrantInputSchema.safeParse({ scopeKind: 'workFileFolder', workProjectId: 'wp1', workFileFolderId: 'f1' }).success,
    ).toBe(false);
  });
});

describe('CreateMediaGrantResultSchema (the answer both grant callables give)', () => {
  it('is the signed grant and its expiry', () => {
    expect(CreateMediaGrantResultSchema.parse({ grant: 'v1.payload.sig', expiresAt: 1_700_000_000_000 })).toEqual({
      grant: 'v1.payload.sig',
      expiresAt: 1_700_000_000_000,
    });
  });

  it('refuses an empty grant, a missing expiry, and extra keys', () => {
    expect(() => CreateMediaGrantResultSchema.parse({ grant: '', expiresAt: 1 })).toThrow();
    expect(() => CreateMediaGrantResultSchema.parse({ grant: 'g' })).toThrow();
    expect(() => CreateMediaGrantResultSchema.parse({ grant: 'g', expiresAt: 1, scope: { w: 'wp1' } })).toThrow();
  });
});

describe('ChatGrantInputSchema (mintChatGrant wire contract)', () => {
  it('accepts channel / invite / inbox scopes', () => {
    expect(ChatGrantInputSchema.parse({ kind: 'channel', workProjectId: 'wp1', guildChatChannelId: 'ch1' }).kind).toBe('channel');
    expect(ChatGrantInputSchema.parse({ kind: 'invite', guildInviteId: 'gi1' }).kind).toBe('invite');
    expect(ChatGrantInputSchema.parse({ kind: 'inbox' }).kind).toBe('inbox');
  });

  it('rejects a channel scope missing the channel id', () => {
    expect(() => ChatGrantInputSchema.parse({ kind: 'channel', workProjectId: 'wp1' })).toThrow();
  });

  it('is strict — an inbox scope carries no extra fields', () => {
    expect(() => ChatGrantInputSchema.parse({ kind: 'inbox', workProjectId: 'wp1' })).toThrow();
  });
});

describe('ResumeFanoutJobInputSchema (resumeFanoutJob wire contract)', () => {
  it('accepts a jobId', () => {
    expect(ResumeFanoutJobInputSchema.parse({ jobId: 'job-1' }).jobId).toBe('job-1');
  });

  it('rejects an empty jobId and extra keys', () => {
    expect(() => ResumeFanoutJobInputSchema.parse({ jobId: '' })).toThrow();
    expect(() => ResumeFanoutJobInputSchema.parse({ jobId: 'job-1', extra: 1 })).toThrow();
  });
});
