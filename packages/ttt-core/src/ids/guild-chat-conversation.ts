/**
 * TTT's chat conversations and their mapping onto the chat packages' neutral reference.
 *
 * The chat packages and the chat Worker know a conversation only as a neutral
 * `ChatConversationRef` (`{ kind, id }`, owned by `@ttt-productions/chat-schemas`). TTT has
 * two realtime conversation kinds — a Work's guild chat channel and a guild invite's
 * conversation — and this module is the one place that turns either into the neutral
 * reference and back.
 */

import type { ChatConversationRef } from '@ttt-productions/chat-schemas';

/** The TTT realtime conversation kinds. */
export const GUILD_CHAT_CONVERSATION_KINDS = ['channel', 'invite'] as const;
export type GuildChatConversationKind = (typeof GUILD_CHAT_CONVERSATION_KINDS)[number];

/** A TTT realtime conversation, named by its own ids. */
export type GuildChatConversation =
  | { kind: 'channel'; workProjectId: string; guildChatChannelId: string }
  | { kind: 'invite'; guildInviteId: string };

/** The neutral `kind` each TTT conversation kind travels under. */
export const CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND = {
  channel: 'guildChannel',
  invite: 'guildInvite',
} as const satisfies Record<GuildChatConversationKind, string>;

/**
 * Separates a channel's Work id from its channel id inside the neutral `id`. Neither id can
 * contain it: every TTT document id is a single Firestore path segment.
 */
const CHANNEL_ID_SEPARATOR = '/';

/** The neutral reference of a TTT conversation. */
export function toChatConversationRef(conversation: GuildChatConversation): ChatConversationRef {
  if (conversation.kind === 'channel') {
    return {
      kind: CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.channel,
      id: `${conversation.workProjectId}${CHANNEL_ID_SEPARATOR}${conversation.guildChatChannelId}`,
    };
  }
  return { kind: CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.invite, id: conversation.guildInviteId };
}

/**
 * The TTT conversation a neutral reference names, or null when it names none — an unknown
 * kind, an empty id, or a channel id that is not exactly two non-empty ids.
 */
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
