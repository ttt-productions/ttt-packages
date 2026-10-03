import { describe, it, expect } from 'vitest';
import { ChatConversationRefSchema } from '@ttt-productions/chat-schemas';
import {
  toChatConversationRef,
  fromChatConversationRef,
  type GuildChatConversation,
} from '../src/ids/guild-chat-conversation';

const CHANNEL: GuildChatConversation = { kind: 'channel', workProjectId: 'wp1', guildChatChannelId: 'ch1' };
const INVITE: GuildChatConversation = { kind: 'invite', guildInviteId: 'gi1' };

describe('TTT conversations travel as the neutral chat reference', () => {
  it('a reference carries no TTT field name — only a kind and an id the chat contract accepts', () => {
    for (const conversation of [CHANNEL, INVITE]) {
      const ref = toChatConversationRef(conversation);
      expect(Object.keys(ref).sort()).toEqual(['id', 'kind']);
      expect(ChatConversationRefSchema.safeParse(ref).success).toBe(true);
    }
  });

  it('every conversation survives the round trip', () => {
    expect(fromChatConversationRef(toChatConversationRef(CHANNEL))).toEqual(CHANNEL);
    expect(fromChatConversationRef(toChatConversationRef(INVITE))).toEqual(INVITE);
  });

  it('a channel and an invite never map to the same reference', () => {
    const channel = toChatConversationRef({ kind: 'channel', workProjectId: 'a', guildChatChannelId: 'b' });
    const invite = toChatConversationRef({ kind: 'invite', guildInviteId: 'a/b' });
    expect(channel).not.toEqual(invite);
  });

  it('two channels of different Works never map to the same reference', () => {
    expect(toChatConversationRef({ kind: 'channel', workProjectId: 'w1', guildChatChannelId: 'c' })).not.toEqual(
      toChatConversationRef({ kind: 'channel', workProjectId: 'w2', guildChatChannelId: 'c' }),
    );
  });

  it('a reference that names no TTT conversation maps to null', () => {
    expect(fromChatConversationRef({ kind: 'room', id: 'x' })).toBeNull();
    expect(fromChatConversationRef({ kind: toChatConversationRef(CHANNEL).kind, id: 'only-one-id' })).toBeNull();
    expect(fromChatConversationRef({ kind: toChatConversationRef(CHANNEL).kind, id: 'a/b/c' })).toBeNull();
    expect(fromChatConversationRef({ kind: toChatConversationRef(CHANNEL).kind, id: '/b' })).toBeNull();
    expect(fromChatConversationRef({ kind: toChatConversationRef(INVITE).kind, id: 'a/b' })).toBeNull();
    expect(fromChatConversationRef({ kind: toChatConversationRef(INVITE).kind, id: '' })).toBeNull();
  });
});

describe('a chat report reads its conversation through the same mapping', () => {
  it('a channel report parent is exactly two ids; an invite report parent is one', async () => {
    const { parseChatChannelRef } = await import('../src/report/chat-report-channel-ref');
    expect(parseChatChannelRef('guild-chat-message', 'wp1/ch1')).toEqual(CHANNEL);
    expect(parseChatChannelRef('guild-invite-message', 'gi1')).toEqual(INVITE);
    expect(parseChatChannelRef('guild-chat-message', 'a/b/c')).toBeNull();
    expect(parseChatChannelRef('guild-chat-message', 'a/')).toBeNull();
    expect(parseChatChannelRef('guild-invite-message', 'a/b')).toBeNull();
    expect(parseChatChannelRef('square-post', 'wp1/ch1')).toBeNull();
  });
});
