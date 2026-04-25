import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import type { MediaProcessingSpec } from "@ttt-productions/media-contracts";

// ============================================
// CHAT ATTACHMENT
// ============================================

export type ChatAttachmentStatus = "pending" | "processing" | "completed" | "failed" | "rejected";

export type ChatAttachment = {
  id: string;                       // pendingMedia doc ID (same as uuid used for upload)
  name: string;                     // original filename
  type: "image" | "video" | "audio" | "text";
  size: number;                     // bytes
  status: ChatAttachmentStatus;
  pendingStoragePath?: string;      // set on upload, cleared after processing
  url?: string;                     // final URL, set by backend after processing
  storagePath?: string;             // final storage path, set by backend
  errorMessage?: string;            // set if failed/rejected
};

// ============================================
// THREAD & MESSAGE
// ============================================

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
  createdAt: number;           // millis
  senderId: string;
  senderUsername?: string;
  text?: string;
  type?: string;               // optional for renderer registry
  attachment?: ChatAttachment; // single, not array
  replyTo?: {
    messageId: string;
    senderUsername: string;
    messagePreview: string;
  };
  isSystemMessage?: boolean;
  meta?: Record<string, unknown>;
};

// ============================================
// CONFIG
// ============================================

export type ChatCoreConfig = {
  db: Firestore;
  chatCollectionPath: string | string[];
  messagesSubcollection?: string;  // default: "messages"
  threadId: string;
  currentUserId: string;
  currentUserDisplayName?: string;
  isAdmin: boolean;
  threadAllowedUserIds?: string[];
  createdAtField?: string;         // default: "createdAt"
  pageSize?: number;
};

// ============================================
// ATTACHMENT CONFIG (passed through ChatShell → Composer)
// ============================================

export type ChatAttachmentConfig = {
  attachmentSpec: MediaProcessingSpec;
  storage: FirebaseStorage;
  /**
   * The current user's auth uid. chat-core builds the canonical
   * `uploads/chat-attachment/{userId}/{pendingMediaDocId}` storage path internally.
   */
  userId: string;
};

// ============================================
// ATTACHMENT HAND-OFF CALLBACK
// ============================================

/**
 * Called by Composer after the file has been uploaded and the consumer's `onSend`
 * has created the message doc. The consumer wires this to a backend callable
 * that writes the `pendingMedia` Firestore doc with `targetDocPath` pointing at
 * the message. Chat-core itself no longer writes `pendingMedia`.
 */
export type SendChatAttachmentInput = {
  uploadStoragePath: string;
  originalFileName: string;
  messageDocPath: string;
  attachmentId: string;
};

export type SendChatAttachmentFn = (input: SendChatAttachmentInput) => Promise<void>;

// ============================================
// MODERATION
// ============================================

export type ModerationHandlers = {
  onReportMessage?: (messageId: string, reason?: string) => void | Promise<void>;
  onReportThread?: (threadId: string, reason?: string) => void | Promise<void>;
  onDeleteMessage?: (messageId: string) => void | Promise<void>; // admin only (gated)
  onDeleteThread?: (threadId: string) => void | Promise<void>;   // admin only (gated)
};

// ============================================
// RENDERING
// ============================================

export type MessageRenderer = (m: ChatMessageV1) => React.ReactNode;

export type MessageRendererRegistry = Record<string, MessageRenderer>;

// ============================================
// MESSAGE GROUPING (internal, exported for tests)
// ============================================

/** Max seconds between messages to be grouped as continuation */
export const GROUP_GAP_SEC = 120;
