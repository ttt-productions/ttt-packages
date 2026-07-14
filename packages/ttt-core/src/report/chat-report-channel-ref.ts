// ============================================================================
// CHAT-REPORT CHANNEL REF — the ONE codec between a chat report's
// (itemType, parentItemId) hint pair and the discriminated realtime channel ref
// (`workProjectId/guildChatChannelId` for a channel report, a bare guildInviteId
// for an invite report). Consolidated here 2026-07-13 from the former
// "mirrors EXACTLY" pair (ttt-prod src/hooks/use-chat-moderation-queries.tsx
// parseChatChannelRef ↔ functions/src/chat-sync/resolveChatMessageSender.ts
// chatChannelRefFromReport). The same union shape is the
// `adminModerateChatMessage` callable's channel input.
// ============================================================================

import { CHAT_REPORT_ITEM_TYPES } from '../doc-schemas/safety/foundation.js';

export type ChatModerationChannelRef =
  | { kind: 'channel'; workProjectId: string; guildChatChannelId: string }
  | { kind: 'invite'; guildInviteId: string };

/**
 * Parse the realtime channel ref out of a chat report. `guild-chat-message` reports
 * carry `workProjectId/guildChatChannelId` as their parent id; `guild-invite-message`
 * reports carry the invite id. Returns null when the report is not a chat report or
 * the parent id is malformed.
 */
export function parseChatChannelRef(
  reportedItemType: string | undefined,
  parentItemId: string | undefined,
): ChatModerationChannelRef | null {
  if (!parentItemId) return null;
  if (reportedItemType === 'guild-invite-message') {
    return { kind: 'invite', guildInviteId: parentItemId };
  }
  if (reportedItemType === 'guild-chat-message') {
    const slash = parentItemId.indexOf('/');
    if (slash <= 0 || slash === parentItemId.length - 1) return null;
    return {
      kind: 'channel',
      workProjectId: parentItemId.slice(0, slash),
      guildChatChannelId: parentItemId.slice(slash + 1),
    };
  }
  return null;
}

/** True for the DO-transported chat report types (derives from the canonical subset). */
export function isChatReportType(reportedItemType: string | undefined): boolean {
  return (CHAT_REPORT_ITEM_TYPES as readonly string[]).includes(reportedItemType ?? '');
}
