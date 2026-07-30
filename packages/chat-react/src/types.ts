// React- and Firebase-client-coupled chat types. These were previously on the
// chat-core root; they live here so the pure chat-core package stays free of
// react / firebase/firestore / firebase/storage references.

import type { ReactNode } from "react";
import type {
  ChatAccessMode,
  ChatMessageV1,
} from "@ttt-productions/chat-core";

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
 * - `firestore` — the current Firestore newest-window + cursor path (default).
 * - `realtime` — the Cloudflare Durable Object socket (chat-edge-rebuild). On
 *   this transport DATA ACCESS is enforced by the DO grant, so `accessMode`
 *   becomes PRESENTATION-ONLY (UI affordances like read-only), never a
 *   data-access gate.
 */
export type ChatTransportMode = 'firestore' | 'realtime';

/**
 * Realtime (Durable Object) transport handle. The concrete socket client is built
 * in this package (`realtime/transport.ts`); chat-react consumes it through this
 * config so the UI stays transport-agnostic. The app builds the `client` via
 * `createRealtimeChatClient({ endpoint, channelRef, grantProvider, ... })` and
 * passes it here. `channelRef`/`client` stay structurally typed (`unknown` at the
 * config seam) so `ChatCoreConfig` does not pull the realtime module's types into
 * every firestore consumer — the realtime hook narrows them at the call site.
 */
export interface ChatRealtimeTransportConfig {
  /** Opaque channel reference the socket is scoped to (guild channel / invite thread). */
  channelRef: unknown;
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
   * The Firestore data-access gate (see ChatAccessMode docs in
   * @ttt-productions/chat-core). REQUIRED. On the `realtime` transport this is
   * PRESENTATION-ONLY — the DO grant is the real data-access authority.
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
// RENDERING
// ============================================

export type MessageRenderer = (m: ChatMessageV1) => ReactNode;

export type MessageRendererRegistry = Record<string, MessageRenderer>;
