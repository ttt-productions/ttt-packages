// Guild chat channel LIFECYCLE callable inputs. One named schema per callable (archive /
// unarchive / delete) rather than a shared alias, so a lane can diverge without touching its
// siblings — while these tests pin the fact that today the three shapes are identical and all
// three are `.strict()`.

import { describe, it, expect } from 'vitest';
import {
  ArchiveGuildChatChannelInputSchema,
  UnarchiveGuildChatChannelInputSchema,
  DeleteGuildChatChannelInputSchema,
  CreateGuildChatChannelInputSchema,
  UpdateGuildChatChannelInputSchema,
  GuildChatChannelLifecycleResultSchema,
  GUILD_CHAT_CHANNEL_ENFORCEMENT_STATES,
  GuildChatConversationSchema,
  AdminModerateChatMessageInputSchema,
  SendGuildChatMessageInputSchema,
} from '../src/schemas/chat';
import { StagedActionSchema } from '../src/schemas/admin';
import { CHAT_MESSAGE_TEXT_MAX_LENGTH } from '@ttt-productions/chat-schemas';

const validInput = { workProjectId: 'wp-1', guildChatChannelId: 'chan-1' };

describe('UnarchiveGuildChatChannelInputSchema', () => {
  it('accepts a workProjectId + guildChatChannelId pair', () => {
    expect(UnarchiveGuildChatChannelInputSchema.parse(validInput)).toEqual(validInput);
  });

  it('requires both ids and rejects empty ones', () => {
    expect(UnarchiveGuildChatChannelInputSchema.safeParse({ workProjectId: 'wp-1' }).success).toBe(false);
    expect(UnarchiveGuildChatChannelInputSchema.safeParse({ guildChatChannelId: 'chan-1' }).success).toBe(false);
    expect(
      UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, workProjectId: '' }).success,
    ).toBe(false);
    expect(
      UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, guildChatChannelId: '' }).success,
    ).toBe(false);
  });

  it('is strict — an unknown key is rejected, never silently dropped', () => {
    const result = UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, isArchived: false });
    expect(result.success).toBe(false);
    // A caller must not be able to smuggle the state it is asking the server to derive.
    expect(UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, force: true }).success).toBe(false);
  });

  it('rejects non-string ids', () => {
    expect(UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, workProjectId: 1 }).success).toBe(false);
    expect(
      UnarchiveGuildChatChannelInputSchema.safeParse({ ...validInput, guildChatChannelId: null }).success,
    ).toBe(false);
  });
});

describe('the three channel-lifecycle inputs are separate declarations of one shape', () => {
  const lanes = {
    archive: ArchiveGuildChatChannelInputSchema,
    unarchive: UnarchiveGuildChatChannelInputSchema,
    delete: DeleteGuildChatChannelInputSchema,
  };

  for (const [lane, schema] of Object.entries(lanes)) {
    it(`${lane} accepts the valid pair and rejects an unknown key`, () => {
      expect(schema.parse(validInput)).toEqual(validInput);
      expect(schema.safeParse({ ...validInput, extra: 'x' }).success).toBe(false);
    });
  }

  it('are distinct schema objects, not aliases of one another', () => {
    expect(UnarchiveGuildChatChannelInputSchema).not.toBe(ArchiveGuildChatChannelInputSchema);
    expect(UnarchiveGuildChatChannelInputSchema).not.toBe(DeleteGuildChatChannelInputSchema);
  });
});

describe('a guild chat channel stores and accepts no member list', () => {
  const create = { workProjectId: 'wp-1', channelName: 'General', requiredGuildStandings: ['Writer'] };

  it('create and update take the access requirement alone', () => {
    expect(CreateGuildChatChannelInputSchema.safeParse(create).success).toBe(true);
    expect(UpdateGuildChatChannelInputSchema.safeParse({ ...validInput, requiredGuildStandings: [] }).success).toBe(true);
  });

  it('a client-sent allowedUserIds list is refused, never stored', () => {
    expect(CreateGuildChatChannelInputSchema.safeParse({ ...create, allowedUserIds: ['u1'] }).success).toBe(false);
    expect(UpdateGuildChatChannelInputSchema.safeParse({ ...validInput, allowedUserIds: ['u1'] }).success).toBe(false);
  });
});

describe('a channel lifecycle answer says whether the chat service already enforces it', () => {
  it('applied or pending, and nothing else', () => {
    expect([...GUILD_CHAT_CHANNEL_ENFORCEMENT_STATES]).toEqual(['applied', 'pending']);
    for (const enforcement of GUILD_CHAT_CHANNEL_ENFORCEMENT_STATES) {
      expect(
        GuildChatChannelLifecycleResultSchema.safeParse({ success: true, guildChatChannelId: 'c1', enforcement }).success,
      ).toBe(true);
    }
    expect(
      GuildChatChannelLifecycleResultSchema.safeParse({ success: true, guildChatChannelId: 'c1', enforcement: 'failed' }).success,
    ).toBe(false);
  });

  it('an answer that does not say is not a valid answer', () => {
    expect(GuildChatChannelLifecycleResultSchema.safeParse({ success: true, guildChatChannelId: 'c1' }).success).toBe(false);
  });
});

describe('one conversation shape for every input that names a chat conversation', () => {
  const channel = { kind: 'channel', workProjectId: 'wp-1', guildChatChannelId: 'c-1' };
  const invite = { kind: 'invite', guildInviteId: 'gi-1' };

  it('the moderation input and the staged tombstone accept exactly the conversation shape', () => {
    const moderate = {
      requestId: 'r1',
      action: 'hide',
      messageSeq: 1,
      expectedMessageRevision: 0,
      caseId: 'case1',
      reason: 'why',
    };
    for (const conversation of [channel, invite]) {
      expect(GuildChatConversationSchema.safeParse(conversation).success).toBe(true);
      expect(AdminModerateChatMessageInputSchema.safeParse({ ...moderate, channel: conversation }).success).toBe(true);
      expect(
        StagedActionSchema.safeParse({ button: 'tombstoneChat', channel: conversation, messageSeq: 1, expectedMessageRevision: 0 }).success,
      ).toBe(true);
    }
    const bad = { kind: 'channel', workProjectId: 'wp-1' };
    expect(AdminModerateChatMessageInputSchema.safeParse({ ...moderate, channel: bad }).success).toBe(false);
    expect(
      StagedActionSchema.safeParse({ button: 'tombstoneChat', channel: bad, messageSeq: 1, expectedMessageRevision: 0 }).success,
    ).toBe(false);
  });

  it('a conversation id must be one document id', () => {
    expect(GuildChatConversationSchema.safeParse({ kind: 'invite', guildInviteId: 'a/b' }).success).toBe(false);
  });
});

describe('the admin-support send uses the one chat text bound', () => {
  const send = { threadKind: 'adminSupport', adminDispatchId: 'd1', isUserReply: true };

  it('accepts text at the bound and refuses one character over', () => {
    expect(SendGuildChatMessageInputSchema.safeParse({ ...send, text: 'x'.repeat(CHAT_MESSAGE_TEXT_MAX_LENGTH) }).success).toBe(true);
    expect(SendGuildChatMessageInputSchema.safeParse({ ...send, text: 'x'.repeat(CHAT_MESSAGE_TEXT_MAX_LENGTH + 1) }).success).toBe(false);
  });
});
