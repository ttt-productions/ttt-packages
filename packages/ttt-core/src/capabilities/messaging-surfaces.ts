import type { CapabilityId } from './capability-registry.js';

export interface MessagingSurface {
  id: string;
  callable: string;
  capability: CapabilityId;
  checksRecipientAtGrant: boolean;
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
    id: 'guildChat.send',
    callable: 'mintChatGrant',
    capability: 'messaging.send',
    checksRecipientAtGrant: true,
    checksRecipientAtSend: false,
  },
  {
    id: 'conversationFile.share',
    callable: 'startUpload',
    capability: 'messaging.fileShare',
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

export const ALL_MESSAGING_SURFACE_IDS = MESSAGING_SURFACES.map((s) => s.id);
