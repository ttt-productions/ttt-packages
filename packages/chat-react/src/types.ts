// React- and Firebase-client-coupled chat types. These were previously on the
// chat-core root; they live here so the pure chat-core package stays free of
// react / firebase/firestore / firebase/storage references.

import type { FirebaseStorage } from "firebase/storage";
import type { ReactNode } from "react";
import type { MediaOriginSpec } from "@ttt-productions/media-schemas";
import type {
  ChatAccessMode,
  ChatMessageV1,
  MentionProvider,
  MentionRef,
  RecentMentionsAdapter,
} from "@ttt-productions/chat-core";

// ============================================
// MENTION RENDER TYPES (React-coupled)
// ============================================

/** Custom renderer for a single autocomplete row / mention result. */
export type MentionResultRenderer<TKind extends string = string> = (
  ref: MentionRef<TKind>,
) => ReactNode;

/**
 * A pure {@link MentionProvider} augmented with optional React row rendering.
 * The autocomplete UI consumes this; the pure provider contract (search) lives
 * in @ttt-productions/chat-core.
 */
export type RenderableMentionProvider<
  TKind extends string = string,
  TContext = unknown,
> = MentionProvider<TKind, TContext> & {
  /**
   * Optional custom row UI. When omitted, the autocomplete renders the
   * `displayText` plain.
   */
  renderResult?: MentionResultRenderer<TKind>;
};

// ============================================
// CHAT UPLOAD ADAPTER (injected into ChatAttachmentConfig)
// ============================================

/**
 * Pluggable upload-path strategy for chat attachments.
 *
 * Consumers supply this to tell the composer (a) what opaque origin identifier
 * to record for the upload, (b) how to build the Firebase Storage path for the
 * temporary upload, and (c) optional extra metadata to attach to the Storage
 * object.
 *
 * `buildUploadPath` and `buildUploadMetadata` receive the userId and
 * attachmentId so consumers can interpolate them per their own conventions.
 * The composer does not interpret `originId` — it forwards it via callbacks
 * and uses it for adapter identity only.
 */
export type ChatUploadAdapter = {
  /** Opaque origin identifier (e.g. "chat-attachment"). Not interpreted here. */
  originId: string;
  /** Build the Firebase Storage path for the upload. Called once per attachment. */
  buildUploadPath: (args: { userId: string; attachmentId: string }) => string;
  /** Optional extra metadata merged onto the Storage object metadata (e.g. customMetadata). */
  buildUploadMetadata?: (args: { userId: string; attachmentId: string }) => Record<string, unknown>;
};

// ============================================
// ATTACHMENT CONFIG (passed through ChatShell → Composer)
// ============================================

export type ChatAttachmentConfig = {
  attachmentSpec: MediaOriginSpec;
  storage: FirebaseStorage;
  /** The current user's auth uid. Forwarded to `uploadAdapter` callbacks. */
  userId: string;
  /**
   * Pluggable upload-path strategy. Consumers wire this to their app's
   * conventions (for example: originId "chat-attachment", path
   * `uploads/chat-attachment/{userId}/{attachmentId}`).
   */
  uploadAdapter: ChatUploadAdapter;
};

// ============================================
// MENTION SYSTEM CONFIG (passed through ChatShell → Composer)
// ============================================

/**
 * Pluggable mention system config. When attached to ChatCoreConfig, the
 * composer enables `@`-trigger autocomplete and the message renderer parses
 * mention tokens out of `text`.
 *
 * Generic over `TKind` and `TContext` is intentionally NOT exposed here at the
 * type level — `ChatCoreConfig` would have to become generic too, which
 * cascades. Instead this type accepts permissive `string`-keyed providers;
 * consumers binding stricter kind unions narrow at the call site via their
 * provider definitions.
 */
export type ChatMentionConfig = {
  /** Providers in display order. */
  providers: RenderableMentionProvider<string, unknown>[];
  /** Context object forwarded to every provider's `search`. */
  context: unknown;
  /** Optional recent-mentions adapter. */
  recent?: RecentMentionsAdapter<string>;
  /** Trigger character. Defaults to `'@'`. */
  trigger?: string;
  /** Minimum query length before search fires. Default: 0. */
  minQueryLength?: number;
  /** Search debounce window in ms. Default: 200. */
  searchDebounceMs?: number;
  /**
   * Optional custom renderer for mentions inside rendered message text.
   * When omitted, the default chip (`<span class="chat-mention-chip">`) is
   * used. Receives the resolved MentionRef.
   */
  renderMention?: (ref: MentionRef) => ReactNode;
};

// ============================================
// CONFIG
// ============================================

export type ChatCoreConfig = {
  chatCollectionPath: string | string[];
  messagesSubcollection?: string;  // default: "messages"
  threadId: string;
  currentUserId: string;
  currentUserDisplayName?: string;
  isAdmin: boolean;
  /**
   * REQUIRED. See ChatAccessMode docs in @ttt-productions/chat-core.
   */
  accessMode: ChatAccessMode;
  /**
   * Required iff accessMode === "explicit-allowlist". Ignored otherwise.
   */
  threadAllowedUserIds?: string[];
  createdAtField?: string;         // default: "createdAt"
  pageSize?: number;
  /**
   * Optional mention system configuration. When present, the composer enables
   * `@`-trigger autocomplete using the supplied providers and renders mention
   * chips in messages. Each provider corresponds to one mention kind.
   */
  mentionConfig?: ChatMentionConfig;
};

// ============================================
// RENDERING
// ============================================

export type MessageRenderer = (m: ChatMessageV1) => ReactNode;

export type MessageRendererRegistry = Record<string, MessageRenderer>;
