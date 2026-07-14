import type { ChatAttachment, ReplyTo } from "@ttt-productions/chat-schemas";

// ============================================
// CHAT ATTACHMENT
// ============================================

// Re-exported from @ttt-productions/chat-schemas, the Tier 0 source of truth.
// chat-schemas is server-safe and can be consumed by both chat-core (pure) and
// backend code without forcing the chat UI dep graph on backend callers.
// An attachment carries a lifecycle `status` (pending -> ready | failed): a
// pending/failed placeholder is visible only to the sender (rule-enforced);
// other participants see it once it is `ready` (or absent = ready/legacy).
export type { ChatAttachment };

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
  replyTo?: ReplyTo;
  isSystemMessage?: boolean;
  /** Moderation tombstone flag on the stored message (backend-written); consumers
   * render a tombstone instead of the content when true. */
  hidden?: boolean;
  meta?: Record<string, unknown>;
};

// ============================================
// ACCESS
// ============================================

/**
 * Access mode controls how chat decides whether the current user can
 * read/write a thread.
 *
 * - "firestore-rules" — trust Firestore rules. canAccessThread returns true
 *   for any signed-in user; if rules deny, onSnapshot will surface
 *   permission-denied. Use this when access depends on data the client doesn't
 *   reliably know up-front (entity membership, invite participation, etc.).
 *
 * - "explicit-allowlist" — access is enforced client-side via
 *   threadAllowedUserIds. The list is required in this mode. Use this when the
 *   consumer already knows the participants (admin/support threads).
 *
 * Admins (`isAdmin: true`) bypass both modes.
 */
export type ChatAccessMode = "firestore-rules" | "explicit-allowlist";

// ============================================
// ATTACHMENT REGISTRATION CALLBACK
// ============================================

/**
 * Called by the composer after the file has been uploaded to Storage. The
 * consumer wires this to a backend callable that writes the pendingMedia doc
 * (caption text + reply pointer) AND a placeholder chat message doc with
 * `attachment.status: 'pending'`. The media processor later flips that same
 * message doc to `ready` (sets `url`) or `failed`.
 *
 * The placeholder bubble therefore arrives through the normal Firestore
 * listener — the composer does not need a separate optimistic local state.
 * While pending/failed the doc is sender-only (rule-enforced).
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
 * the chat UI will render a stable fallback ("User") in that case.
 */
export type ChatNameResolver = (senderId: string) => string | null;

/**
 * Optional pre-warm callback. The chat UI calls this with the deduped list of
 * senderIds visible in the current message page so the consuming app can
 * batch-fetch names into its cache. Implementations should be idempotent —
 * the same id list will be passed across re-renders.
 */
export type ChatPrewarmSenders = (senderIds: string[]) => void;
