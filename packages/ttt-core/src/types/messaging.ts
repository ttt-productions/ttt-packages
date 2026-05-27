// Messaging types: Chat channels, Invite conversations, Admin messages.
//
// NOTE: Per-message body shapes (channel messages, invite messages,
// admin conversation messages) live in @ttt-productions/chat-core as
// ChatMessageV1. ttt-core only owns the parent thread document shapes.

import type { InviteSource } from '../schemas/work-project-management.js';

// --- WorkProject Chat ---

export interface GuildChatChannel {
  guildChatChannelId: string;
  workProjectId: string;
  channelName: string;
  description?: string;
  requiredGuildStandings: string[];
  allowedUserIds: string[];
  createdAt: number;
  createdBy: string;
  lastMessageAt?: string;
  lastMessage?: string;
  messageCount: number;
  isArchived: boolean;
}

// --- WorkProject Invite Conversations ---

export interface GuildInviteConversation {
  inviteId: string;
  workProjectId: string;
  relatedUserIds: string[];
  workProjectTitle: string;
  workProject: {
    workProjectId: string;
    workingTitle: string;
    type: string;
    workingDescription: string;
  };
  workSteward: { uid: string };
  sender: { uid: string };
  recipient: { uid: string };
  stakeSharesOffered: number;
  source: InviteSource;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'finalized' | 'error';
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
  senderConfirmed: boolean;
  recipientConfirmed: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
}

// --- Admin Messages ---

export interface AdminDispatch {
  adminDispatchId: string;
  userId: string;
  initiatorUserId: string;
  initiatedBy: 'user' | 'admin';
  subject: string;
  status: 'open' | 'user_reply' | 'admin_reply' | 'closed_resolved' | 'closed_unresolved';
  createdAt: number;
  lastUpdatedAt: number;
  readByAdmin: boolean;
  readByUser: boolean;
  /**
   * Set when the thread is closed (status starts with 'closed_').
   * Records the uid of the actor who closed it (admin or thread stewardOwner).
   * Used for future investigation of closed_unresolved threads.
   */
  closedBy?: string;
}

