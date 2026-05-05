import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import type { TTTMediaOriginEntry } from "@ttt-productions/media-contracts";

// ============================================
// CHAT ATTACHMENT
// ============================================

// Chat message docs are only ever written by the server after media
// processing + moderation succeed. There is no pending/processing/failed/
// rejected state on attachments in chat — rejection visibility lives on
// /profile/uploads (the canonical pendingMedia surface). Every attachment
// on a chat message doc is fully processed and viewable.
export type ChatAttachment = {
  id: string;                       // pendingMedia doc ID
  name: string;                     // original filename
  type: "image" | "video" | "audio" | "text";
  size: number;                     // bytes
  url: string;                      // final URL (always present)
  storagePath: string;              // final storage path (always present)
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
  text?: string;
  type?: string;               // optional for renderer registry
  attachment?: ChatAttachment; // single, not array
  replyTo?: {
    messageId: string;
    senderId: string;
    messagePreview: string;
  };
  isSystemMessage?: boolean;
  meta?: Record<string, unknown>;
};

// ============================================
// CONFIG
// ============================================

/**
 * Access mode controls how chat-core decides whether the current user
 * can read/write a thread.
 *
 * - "firestore-rules" — chat-core trusts Firestore rules. canAccessThread
 *   returns true for any signed-in user; if rules deny, onSnapshot will
 *   surface permission-denied. Use this when access depends on data the
 *   client doesn't reliably know up-front (project membership, invite
 *   participation, etc.).
 *
 * - "explicit-allowlist" — chat-core enforces access client-side via
 *   threadAllowedUserIds. The list is required in this mode. Use this
 *   when the consumer already knows the participants (admin/support
 *   threads).
 *
 * Admins (`isAdmin: true`) bypass both modes.
 */
export type ChatAccessMode = "firestore-rules" | "explicit-allowlist";

export type ChatCoreConfig = {
  db: Firestore;
  chatCollectionPath: string | string[];
  messagesSubcollection?: string;  // default: "messages"
  threadId: string;
  currentUserId: string;
  currentUserDisplayName?: string;
  isAdmin: boolean;
  /**
   * REQUIRED. See ChatAccessMode docs.
   */
  accessMode: ChatAccessMode;
  /**
   * Required iff accessMode === "explicit-allowlist". Ignored otherwise.
   */
  threadAllowedUserIds?: string[];
  createdAtField?: string;         // default: "createdAt"
  pageSize?: number;
};

// ============================================
// ATTACHMENT CONFIG (passed through ChatShell → Composer)
// ============================================

export type ChatAttachmentConfig = {
  attachmentSpec: TTTMediaOriginEntry;
  storage: FirebaseStorage;
  /**
   * The current user's auth uid. chat-core builds the canonical
   * `uploads/chat-attachment/{userId}/{pendingMediaDocId}` storage path internally.
   */
  userId: string;
};

// ============================================
// ATTACHMENT REGISTRATION CALLBACK
// ============================================

/**
 * Called by Composer after the file has been uploaded to Storage. The consumer
 * wires this to a backend callable (`startUpload`) that writes the pendingMedia
 * doc with the caption text + reply pointer. The processor will create the
 * message doc itself after media moderation succeeds.
 *
 * No message doc is created at this point — Composer should render an
 * optimistic local "uploading" state until the listener delivers the real
 * message after processing completes.
 */
export type SendAttachmentInput = {
  text: string;
  attachment: {
    attachmentId: string;       // pendingMedia doc ID
    storagePath: string;        // uploads/chat-attachment/{uid}/{attachmentId}
    originalFileName: string;
    type: ChatAttachment["type"];
    size: number;
  };
  replyTo?: ChatMessageV1["replyTo"];
};

export type SendAttachmentFn = (input: SendAttachmentInput) => Promise<void>;

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

// ============================================
// NAME RESOLUTION
// ============================================

/**
 * Resolves a senderId to a display name synchronously from app-side cache.
 * Returns null if the sender is unknown or the cache hasn't loaded yet —
 * chat-core will render a stable fallback ("User") in that case.
 */
export type ChatNameResolver = (senderId: string) => string | null;

/**
 * Optional pre-warm callback. chat-core calls this with the deduped list of
 * senderIds visible in the current message page so the consuming app can
 * batch-fetch names into its cache. Implementations should be idempotent —
 * the same id list will be passed across re-renders.
 */
export type ChatPrewarmSenders = (senderIds: string[]) => void;
