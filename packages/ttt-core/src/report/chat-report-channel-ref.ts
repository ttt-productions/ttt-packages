import { CHAT_REPORT_ITEM_TYPES } from '../doc-schemas/safety/foundation.js';
import {
  CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND,
  fromChatConversationRef,
  type GuildChatConversation,
} from '../ids/guild-chat-conversation.js';

export function parseChatChannelRef(
  reportedItemType: string | undefined,
  parentItemId: string | undefined,
): GuildChatConversation | null {
  if (!parentItemId) return null;
  if (reportedItemType === 'guild-invite-message') {
    return fromChatConversationRef({
      kind: CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.invite,
      id: parentItemId,
    });
  }
  if (reportedItemType === 'guild-chat-message') {
    return fromChatConversationRef({
      kind: CHAT_CONVERSATION_REF_KIND_BY_GUILD_KIND.channel,
      id: parentItemId,
    });
  }
  return null;
}

export function isChatReportType(reportedItemType: string | undefined): boolean {
  return (CHAT_REPORT_ITEM_TYPES as readonly string[]).includes(reportedItemType ?? '');
}
