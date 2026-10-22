import type { ChatConversationRef, ChatRoomNamespace } from '@ttt-productions/chat-schemas';

export const GUILD_CHAT_CONVERSATION_KINDS = ['channel', 'invite'] as const;
export type GuildChatConversationKind = (typeof GUILD_CHAT_CONVERSATION_KINDS)[number];

export type GuildChatConversation =
  | { kind: 'channel'; workProjectId: string; guildChatChannelId: string }
  | { kind: 'invite'; guildInviteId: string };

export const CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND = {
  channel: 'guildChannel',
  invite: 'guildInvite',
} as const satisfies Record<GuildChatConversationKind, string>;

// Neither id can contain it: every TTT document id is a single Firestore path segment.
const CHANNEL_ID_SEPARATOR = '/';

export function toChatConversationRef(conversation: GuildChatConversation): ChatConversationRef {
  if (conversation.kind === 'channel') {
    return {
      kind: CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.channel,
      id: `${conversation.workProjectId}${CHANNEL_ID_SEPARATOR}${conversation.guildChatChannelId}`,
    };
  }
  return { kind: CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.invite, id: conversation.guildInviteId };
}

export function fromChatConversationRef(ref: ChatConversationRef): GuildChatConversation | null {
  if (!ref.id) return null;
  if (ref.kind === CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.invite) {
    return ref.id.includes(CHANNEL_ID_SEPARATOR) ? null : { kind: 'invite', guildInviteId: ref.id };
  }
  if (ref.kind === CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.channel) {
    const parts = ref.id.split(CHANNEL_ID_SEPARATOR);
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return { kind: 'channel', workProjectId: parts[0], guildChatChannelId: parts[1] };
  }
  return null;
}

// A wire value the server and the chat Worker must build identically (RULE-STD-ARCH-005).
export const TTT_CHAT_ROOM_PRODUCT = 'ttt';

export function tttChatRoomNamespace(env: string): ChatRoomNamespace {
  return { product: TTT_CHAT_ROOM_PRODUCT, env };
}
