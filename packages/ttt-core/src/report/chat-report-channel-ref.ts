// The ONE codec between a chat report's (itemType, parentItemId) hint pair and the TTT
// conversation it names: a channel report's parent id is `workProjectId/guildChatChannelId`,
// an invite report's is the bare guildInviteId.

import { CHAT_REPORT_ITEM_TYPES } from '../doc-schemas/safety/foundation.js';
import {
  CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND,
  fromChatConversationRef,
  type GuildChatConversation,
} from '../ids/guild-chat-conversation.js';

/**
 * Parse the conversation out of a chat report. `guild-chat-message` reports
 * carry `workProjectId/guildChatChannelId` as their parent id; `guild-invite-message`
 * reports carry the invite id. Returns null when the report is not a chat report or
 * the parent id is malformed.
 */
export function parseChatChannelRef(
  reportedItemType: string | undefined,
  parentItemId: string | undefined,
): GuildChatConversation | null {
  if (!parentItemId) return null;
  // A report's parent id is the conversation's neutral id, so it is read by the one mapping.
  if (reportedItemType === 'guild-invite-message') {
    return fromChatConversationRef({ kind: CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.invite, id: parentItemId });
  }
  if (reportedItemType === 'guild-chat-message') {
    return fromChatConversationRef({ kind: CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.channel, id: parentItemId });
  }
  return null;
}

/** True for the DO-transported chat report types (derives from the canonical subset). */
export function isChatReportType(reportedItemType: string | undefined): boolean {
  return (CHAT_REPORT_ITEM_TYPES as readonly string[]).includes(reportedItemType ?? '');
}
