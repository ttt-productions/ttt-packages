// React- and Firebase-client-coupled chat types. These were previously on the
// chat-core root; they live here so the pure chat-core package stays free of
// react / firebase/firestore / firebase/storage references.

import type { ReactNode } from "react";
import type { ChatMessageV1 } from "@ttt-productions/chat-core";
import type { ChatConversationRef } from "@ttt-productions/chat-schemas";

// ============================================
// CONFIG
// ============================================
//
// Chat carries PLAIN TEXT only. There is no upload adapter, attachment config,
// or mention/token config here: a conversation's files are owned by the
// consuming app's Conversation Files surface, which runs the canonical upload
// pipeline outside the chat timeline.

/**
 * Which transport backs a chat thread.
 * - `firestore` — the Firestore newest-window + cursor path (default).
 * - `realtime` — the Cloudflare Durable Object socket; the grant is the data-access
 *   authority there.
 */
export type ChatTransportMode = 'firestore' | 'realtime';

/**
 * Realtime (Durable Object) transport handle. The concrete socket client is built
 * in this package (`realtime/transport.ts`); chat-react consumes it through this
 * config so the UI stays transport-agnostic. The app builds the `client` via
 * `createRealtimeChatClient({ endpoint, channelRef, grantProvider, ... })` and
 * passes it here. `client` stays structurally typed (`unknown` at the config seam)
 * so `ChatCoreConfig` does not pull the realtime module's types into every firestore
 * consumer — the realtime hook narrows it at the call site.
 */
export interface ChatRealtimeTransportConfig {
  /** The conversation the socket is scoped to, as the app maps it onto the neutral reference. */
  channelRef: ChatConversationRef;
  /**
   * The realtime client handle from `createRealtimeChatClient(...)`. Drives the
   * channel socket (subscribe / send / ack / typing / presence / history). The UI
   * never reaches into the socket directly — it goes through `useRealtimeChatMessages`.
   */
  client: unknown;
}

export type ChatCoreConfig = {
  chatCollectionPath: string | string[];
  messagesSubcollection?: string;  // default: "messages"
  threadId: string;
  currentUserId: string;
  currentUserDisplayName?: string;
  isAdmin: boolean;
  /**
   * Which transport backs this thread. Defaults to `'firestore'` (the current
   * path) so existing call sites are unchanged. See {@link ChatTransportMode}.
   */
  transport?: ChatTransportMode;
  /** Required iff `transport === 'realtime'`; ignored on the firestore transport. */
  realtime?: ChatRealtimeTransportConfig;
  /**
   * Whether the current user may read this conversation — the app's ONE access fact,
   * decided by the app's own rule for the conversation's kind (the package never decides
   * access). False renders the no-access state and reads nothing. On the `realtime`
   * transport the grant is the data authority, and a terminal denial from the grant
   * closes the conversation even when this is true.
   */
  allowed: boolean;
  createdAtField?: string;         // default: "createdAt"
  pageSize?: number;
};

// ============================================
// RENDERING
// ============================================

export type MessageRenderer = (m: ChatMessageV1) => ReactNode;

export type MessageRendererRegistry = Record<string, MessageRenderer>;
