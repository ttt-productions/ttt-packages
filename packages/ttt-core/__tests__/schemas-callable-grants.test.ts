import { describe, it, expect } from 'vitest';
import {
  CreateMediaGrantInputSchema,
  ChatGrantInputSchema,
  ResumeFanoutJobInputSchema,
} from '../src/schemas/index.js';

// These three client-called callable input schemas were migrated out of local
// definitions in the functions repo (callable-validation convention: all callable
// input schemas live in ttt-core/schemas). See
// CODE_CHANGE_local_callable_input_schemas_drift.md.

describe('CreateMediaGrantInputSchema (media grant wire contract)', () => {
  it('accepts each scopeKind variant', () => {
    expect(CreateMediaGrantInputSchema.parse({ scopeKind: 'workProject', workProjectId: 'wp1' }).scopeKind).toBe('workProject');
    expect(
      CreateMediaGrantInputSchema.parse({ scopeKind: 'workFileFolder', workProjectId: 'wp1', workFileFolderId: 'f1' }).scopeKind,
    ).toBe('workFileFolder');
    expect(
      CreateMediaGrantInputSchema.parse({ scopeKind: 'commissionProposal', commissionListingId: 'c1', commissionProposalId: 'p1' }).scopeKind,
    ).toBe('commissionProposal');
    expect(
      CreateMediaGrantInputSchema.parse({ scopeKind: 'guildChannel', workProjectId: 'wp1', guildChatChannelId: 'ch1' }).scopeKind,
    ).toBe('guildChannel');
    expect(CreateMediaGrantInputSchema.parse({ scopeKind: 'guildInvite', guildInviteId: 'gi1' }).scopeKind).toBe('guildInvite');
  });

  it('rejects an unknown scopeKind', () => {
    expect(() => CreateMediaGrantInputSchema.parse({ scopeKind: 'wholeWork', workProjectId: 'wp1' })).toThrow();
  });

  it('is strict — a workFileFolder scope must not omit the folder id or carry extra keys', () => {
    expect(() => CreateMediaGrantInputSchema.parse({ scopeKind: 'workFileFolder', workProjectId: 'wp1' })).toThrow();
    expect(() =>
      CreateMediaGrantInputSchema.parse({ scopeKind: 'guildInvite', guildInviteId: 'gi1', extra: 'x' }),
    ).toThrow();
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
