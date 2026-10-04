/**
 * Who may take part in TTT's realtime conversations — ONE rule per conversation kind. The grant
 * minting, the access projection the chat rooms enforce, the conversation-file checks, and every
 * screen that lists or offers a conversation decide from these, never from a restatement.
 */

import type { GuildmateUser } from '../doc-schemas/work-project.js';
import { FOUNDING_WORK_HOLDER_TYPE } from '../doc-schemas/work-project.js';
import type { GuildChatChannel } from '../doc-schemas/messaging.js';
import type { GuildInviteConversationStatus } from '../schemas/atoms.js';
import {
  GUILD_INVITE_HANDLER_GUILD_STANDING_IDS,
  guildStandingsGrantAction,
} from '../permissions/work-project-permissions.js';

/** The Guildmate facts a conversation rule reads. */
export type GuildChatAccessMember = Pick<GuildmateUser, 'status' | 'holderType' | 'guildStandings' | 'tradeProfessions'>;

function isActivePersonGuildmate(member: GuildChatAccessMember | null): member is GuildChatAccessMember {
  return member !== null && member.status === 'active' && member.holderType !== FOUNDING_WORK_HOLDER_TYPE;
}

/**
 * Whether a Guildmate may use a Work's guild chat channel: an active person Guildmate (never the
 * founding-Work stake holder) of a channel that exists and is not deleted, holding one of the
 * channel's required standings OR trade professions — an empty requirement admits every active
 * Guildmate.
 */
export function canAccessGuildChatChannel(
  member: GuildChatAccessMember | null,
  channel: Pick<GuildChatChannel, 'requiredGuildStandings' | 'isDeleted'> | null,
): boolean {
  if (!channel || channel.isDeleted === true) return false;
  if (!isActivePersonGuildmate(member)) return false;
  if (channel.requiredGuildStandings.length === 0) return true;
  const held = new Set<string>([...member.guildStandings, ...member.tradeProfessions]);
  return channel.requiredGuildStandings.some((required) => held.has(required));
}

/** The invite statuses whose conversation is open: negotiating, or accepted and being confirmed. */
export const GUILD_INVITE_CONVERSATION_LIVE_STATUSES = [
  'pending',
  'accepted',
] as const satisfies readonly GuildInviteConversationStatus[];

export function isGuildInviteConversationLive(status: string): boolean {
  return (GUILD_INVITE_CONVERSATION_LIVE_STATUSES as readonly string[]).includes(status);
}

/** The two sides of an invite: the person invited, and the inviting Work. */
export type GuildInviteParty = 'recipient' | 'work';

/**
 * Which side of an invite a person takes part on, or null when they take no part. The recipient
 * is the `recipient` side. The Work's side is the sender, and every active person Guildmate of the
 * inviting Work who holds an invite-handling standing (`GUILD_INVITE_HANDLER_GUILD_STANDING_IDS`):
 * they see the conversation, reply in it, and accept for the Work. `member` is the person's
 * Guildmate record in the inviting Work, or null when they have none.
 */
export function guildInvitePartyOf(args: {
  uid: string;
  senderUid: string;
  recipientUid: string;
  member: GuildChatAccessMember | null;
}): GuildInviteParty | null {
  const { uid, senderUid, recipientUid, member } = args;
  if (!uid) return null;
  if (uid === recipientUid) return 'recipient';
  if (uid === senderUid) return 'work';
  if (!isActivePersonGuildmate(member)) return null;
  const handles = member.guildStandings.some((standing) =>
    (GUILD_INVITE_HANDLER_GUILD_STANDING_IDS as readonly string[]).includes(standing),
  );
  return handles ? 'work' : null;
}

/** How a person opens an invite: as one of its two sides, or as a stake editor of the inviting Work. */
export type GuildInviteViewerRole = GuildInviteParty | 'stakeEditor';

/**
 * How a person may open an invite, or null when they may not. A party opens it on its own side
 * (`guildInvitePartyOf`). Any other active person Guildmate of the inviting Work whose standings
 * grant both `guildInvite.list` and `guildInvite.stakeShares.update` — a stake-power standing that
 * handles no invites — opens it as a `stakeEditor`: they see the invite and its offer to change
 * the offer, and take no part in the conversation, its files, the Work's agreement, or a cancel.
 */
export function guildInviteViewerRoleOf(args: {
  uid: string;
  senderUid: string;
  recipientUid: string;
  member: GuildChatAccessMember | null;
}): GuildInviteViewerRole | null {
  const party = guildInvitePartyOf(args);
  if (party !== null) return party;
  const { uid, member } = args;
  if (!uid || !isActivePersonGuildmate(member)) return null;
  const opensToChangeOffer =
    guildStandingsGrantAction(member.guildStandings, 'guildInvite.list') &&
    guildStandingsGrantAction(member.guildStandings, 'guildInvite.stakeShares.update');
  return opensToChangeOffer ? 'stakeEditor' : null;
}

/** Whether a person may open an invite (read the invite itself): a party, or a stake editor. */
export function canViewGuildInvite(args: {
  uid: string;
  senderUid: string;
  recipientUid: string;
  member: GuildChatAccessMember | null;
}): boolean {
  return guildInviteViewerRoleOf(args) !== null;
}

/** Whether a person may use an invite's conversation now: a party to it, while it is open. */
export function canAccessGuildInviteConversation(args: {
  uid: string;
  senderUid: string;
  recipientUid: string;
  member: GuildChatAccessMember | null;
  status: string;
}): boolean {
  return guildInvitePartyOf(args) !== null && isGuildInviteConversationLive(args.status);
}

/**
 * Whether a Guildmate may cancel the Work's invites: an active person Guildmate whose standings
 * grant `guildInvite.revokeAny`. Sending an invite gives no power to cancel it — a sender cancels
 * only while holding one of those standings.
 */
export function canCancelGuildInvite(member: GuildChatAccessMember | null): boolean {
  return isActivePersonGuildmate(member) && guildStandingsGrantAction(member.guildStandings, 'guildInvite.revokeAny');
}
