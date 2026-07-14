// ============================================================================
// NO-MINOR-MESSAGING — the ONE route/entry-point inventory. Consolidated here
// 2026-07-13 from the former byte-for-byte mirrors in ttt-prod
// `src/lib/capabilities/messaging-surfaces.ts` and
// `functions/src/shared/messaging-surfaces.ts` (both trees now import this;
// the two-tree sync tests are deleted).
// ============================================================================

import type { CapabilityId } from './capability-registry.js';

export interface MessagingSurface {
  /** Stable id for the entry point. */
  id: string;
  /** The backend callable / worker that owns this surface. */
  callable: string;
  /** The messaging capability that gates it (MUST be a bilateral capability). */
  capability: CapabilityId;
  /** Whether the recipient is checked at GRANT time (e.g. invite creation). */
  checksRecipientAtGrant: boolean;
  /** Whether the recipient is (re)checked at SEND time. */
  checksRecipientAtSend: boolean;
}

export const MESSAGING_SURFACES: readonly MessagingSurface[] = [
  {
    id: 'guildInvite.send',
    callable: 'inviteUserToGuild',
    capability: 'messaging.guildInvite',
    checksRecipientAtGrant: true,
    checksRecipientAtSend: true,
  },
  {
    // Realtime via the chat Worker DOs: the no-minor (18+) check is at CONNECT/GRANT time in
    // `mintChatGrant` (`authorizeChannelScope` → assertCapability('messaging.send')) per peer, NOT
    // re-checked per message; an access revoke closes the live socket. `sendGuildChatMessage` is
    // admin-support-only now.
    id: 'guildChat.send',
    callable: 'mintChatGrant',
    capability: 'messaging.send',
    checksRecipientAtGrant: true,
    checksRecipientAtSend: false,
  },
  {
    id: 'guildChat.attachment',
    callable: 'mintChatGrant',
    capability: 'messaging.attachment',
    checksRecipientAtGrant: true,
    checksRecipientAtSend: false,
  },
  {
    id: 'inviteConversation.send',
    callable: 'mintChatGrant',
    capability: 'messaging.send',
    checksRecipientAtGrant: true,
    checksRecipientAtSend: false,
  },
] as const;

/** Surface ids (for the exhaustiveness test). */
export const ALL_MESSAGING_SURFACE_IDS = MESSAGING_SURFACES.map((s) => s.id);
