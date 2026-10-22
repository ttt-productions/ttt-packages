import type { GuildmateUser } from '../doc-schemas/work-project.js';
import type { GuildChatChannel } from '../doc-schemas/messaging.js';
import { FOUNDING_WORK_HOLDER_TYPE } from '../doc-schemas/work-project.js';
import type { GuildInviteConversationStatus } from '../schemas/atoms.js';
import { GUILD_INVITE_HANDLER_GUILD_STANDING_IDS } from '../permissions/work-project-permissions-data.js';
import { guildStandingsGrantAction } from '../permissions/work-project-permissions.js';

export type GuildChatAccessMember = Pick<
  GuildmateUser,
  'status' | 'holderType' | 'guildStandings' | 'tradeProfessions'
>;

function isActivePersonGuildmate(
  member: GuildChatAccessMember | null,
): member is GuildChatAccessMember {
  return (
    member !== null && member.status === 'active' && member.holderType !== FOUNDING_WORK_HOLDER_TYPE
  );
}

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

export const GUILD_INVITE_CONVERSATION_LIVE_STATUSES = [
  'pending',
  'accepted',
] as const satisfies readonly GuildInviteConversationStatus[];

export function isGuildInviteConversationLive(status: string): boolean {
  return (GUILD_INVITE_CONVERSATION_LIVE_STATUSES as readonly string[]).includes(status);
}

export type GuildInviteParty = 'recipient' | 'work';

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

export function canAccessGuildInviteConversation(args: {
  uid: string;
  senderUid: string;
  recipientUid: string;
  member: GuildChatAccessMember | null;
  status: string;
}): boolean {
  return guildInvitePartyOf(args) !== null && isGuildInviteConversationLive(args.status);
}

export function canCancelGuildInvite(member: GuildChatAccessMember | null): boolean {
  return (
    isActivePersonGuildmate(member) &&
    guildStandingsGrantAction(member.guildStandings, 'guildInvite.revokeAny')
  );
}
