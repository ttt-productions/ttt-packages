import type { Firestore } from "firebase/firestore";

export type ChatId = string;

export type ChatThreadV1 = {
  allowedUserIds: string[];
  participantUserIds?: string[];
  createdAt: number;       // millis
  lastMessageAt: number;   // millis
  status?: string;         // opaque to chat-core
  meta?: Record<string, unknown>; // opaque
};

export type ChatMessageV1 = {
  messageId: string;
  threadId: string;
  createdAt: number; // millis
  senderId: string;
  senderUsername?: string;
  text?: string;
  type?: string; // optional for renderer registry
  meta?: Record<string, unknown>;
};

export type ChatCollectionConfig = {
  /** top-level collection name, e.g. "projectChats" | "adminThreads" | "inviteChats" */
  chatCollection: string;
};

export type ChatCoreConfig = ChatCollectionConfig & {
  db: Firestore;
  pageSize?: number;

  threadId: string;
  currentUserId: string;
  isAdmin: boolean;

  /** If provided, used to gate access; otherwise only isAdmin applies */
  threadAllowedUserIds?: string[];

  /** Optional: tell chat-core which field to order by; must be indexed */
  createdAtField?: string; // default "createdAt"
};

export type ModerationHandlers = {
  onReportMessage?: (messageId: string, reason?: string) => void | Promise<void>;
  onReportThread?: (threadId: string, reason?: string) => void | Promise<void>;
  onDeleteMessage?: (messageId: string) => void | Promise<void>; // admin only (gated)
  onDeleteThread?: (threadId: string) => void | Promise<void>;   // admin only (gated)
};

export type MessageRenderer = (m: ChatMessageV1) => React.ReactNode;

export type MessageRendererRegistry = Record<string, MessageRenderer>;
