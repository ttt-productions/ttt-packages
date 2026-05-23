// Messaging types: Chat channels, Invite conversations, Admin messages.
//
// NOTE: Per-message body shapes (channel messages, invite messages,
// admin conversation messages) live in @ttt-productions/chat-core as
// ChatMessageV1. ttt-core only owns the parent thread document shapes.

import type { InviteSource } from '../schemas/project-management.js';

// --- Project Chat ---

export interface ChatChannel {
  channelId: string;
  projectId: string;
  channelName: string;
  description?: string;
  requiredRoles: string[];
  allowedUserIds: string[];
  createdAt: number;
  createdBy: string;
  lastMessageAt?: string;
  lastMessage?: string;
  messageCount: number;
  isArchived: boolean;
}

// --- Project Invite Conversations ---

export interface ProjectInviteConversation {
  inviteId: string;
  projectId: string;
  relatedUserIds: string[];
  projectTitle: string;
  project: {
    projectId: string;
    workingTitle: string;
    type: string;
    workingDescription: string;
  };
  projectOwner: { uid: string };
  sender: { uid: string };
  recipient: { uid: string };
  sharesOffered: number;
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

export interface AdminMessage {
  messageId: string;
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
   * Records the uid of the actor who closed it (admin or thread owner).
   * Used for future investigation of closed_unresolved threads.
   */
  closedBy?: string;
}
