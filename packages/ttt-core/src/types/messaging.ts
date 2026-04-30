// Messaging types: Chat channels, Invite conversations, Admin messages

// --- Message Attachments ---

export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'video' | 'audio';
  size: number;
  storagePath: string;
}

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

export interface ChatMessage {
  messageId: string;
  channelId: string;
  projectId: string;
  senderId: string;
  text: string;
  createdAt: number;
  editedAt?: string;
  attachments?: MessageAttachment[];
  replyTo?: {
    messageId: string;
    senderId: string;
    messagePreview: string;
  };
  isSystemMessage?: boolean;
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
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'finalized' | 'error';
  createdAt: number;
  updatedAt: number;
  finalizedAt?: number;
  senderConfirmed: boolean;
  recipientConfirmed: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface ProjectInviteMessage {
  messageId: string;
  inviteId: string;
  senderId: string;
  message: string;
  createdAt: number;
  attachments?: MessageAttachment[];
  replyTo?: {
    messageId: string;
    senderId: string;
    messagePreview: string;
  };
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
}

// --- Helper Types ---

export type MessageStatus =
  | 'pending'
  | 'active'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'error'
  | 'finalized'
  | 'closed_resolved'
  | 'closed_unresolved';
