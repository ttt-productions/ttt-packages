// ============================================
// THREAD & MESSAGE
// ============================================
//
// Chat is TEXT-ONLY. A message never carries a file: files belong to the
// CONVERSATION (the Conversation Files list owned by the consuming app), not to
// a message in its timeline. There is no attachment contract in this package.
//
// A message also carries NO reply pointer: no chat surface has an authoring
// affordance for replying to a specific message, so a `replyTo` contract here
// would be unreachable machinery (DJ ruling 2026-07-29).

export type ChatId = string;

export type ChatThreadV1 = {
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
  isSystemMessage?: boolean;
  /**
   * Account ids a server-written message's text refers to, stored beside the text (never inside
   * it). The UI prewarms and resolves them like senders; an account's anonymization rewrites them.
   */
  referencedUids?: string[];
  /** Moderation tombstone flag on the stored message (backend-written); consumers
   * render a tombstone instead of the content when true. */
  hidden?: boolean;
  meta?: Record<string, unknown>;
};

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
 * What the app knows about a sender's display name right now. `pending` — the read has
 * not answered; `unavailable` — the read answered and there is no person to name;
 * `failed` — the read failed, and `retry` asks again. Only `resolved` carries a name:
 * the chat UI never invents one for the other three, it hands them to the app's
 * renderer (chat-react's `renderUnresolvedName`).
 */
export type ChatNameResolution =
  | { status: 'resolved'; name: string }
  | { status: 'pending' }
  | { status: 'unavailable' }
  | { status: 'failed'; retry: () => void };

/**
 * Resolves a senderId synchronously from the app's own cache. Called during render,
 * so it reads what the app already holds and never starts a fetch itself — the app
 * fetches through {@link ChatPrewarmSenders}.
 */
export type ChatNameResolver = (senderId: string) => ChatNameResolution;

/**
 * Optional pre-warm callback. The chat UI calls this with the deduped list of
 * senderIds visible in the current message page so the consuming app can
 * batch-fetch names into its cache. Implementations should be idempotent —
 * the same id list will be passed across re-renders.
 */
export type ChatPrewarmSenders = (senderIds: string[]) => void;
