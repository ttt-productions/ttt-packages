"use client";

// React hook for the REALTIME transport, returning the SAME shape as
// `useChatMessages` (the firestore path) so `ChatShell` is transport-agnostic.
// It SUBSCRIBES to a `RealtimeChatClient`'s observable state. It does NOT own the
// socket lifecycle: the caller (the app hook that CREATES the client, e.g.
// `useRealtimeChannelClient`) is the single connect/close owner (C-B7) — connecting
// here too opened a second WebSocket. The client instance is owned by the caller
// (passed via config) so its identity is the subscription key — a new client for a
// new uid replaces the old one (Contract A auth-user-switch teardown happens in the
// owning hook).

import * as React from "react";
import type { ChatMessageV1 } from "@ttt-productions/chat-core";
import type { RealtimeChatClient } from "./transport.js";
import type { ChannelClientState } from "./channel-client.js";
import { useOptionalChatNameResolver } from "../context/ChatNameResolverContext.js";

export type UseRealtimeChatMessagesResult = {
  allowed: boolean;
  isInitialLoading: boolean;
  messages: ChatMessageV1[];
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  /** Realtime extras (not present on the firestore result) — optional for the UI. */
  status: ChannelClientState["status"];
  /** The last structured error code the DO sent (e.g. a close reason). Drives the
   *  disconnected-banner detail (R13). */
  lastErrorCode: string | null;
  typing: string[];
  presence: string[];
  /** Returns false when the socket was closed and nothing was sent (C-B8) — the caller keeps the composer text. */
  send: (text: string, replyTo?: { messageSeq: number; preview: string } | null) => boolean;
  /** Retry a failed/un-acked send by its ORIGINAL clientMessageId (read from the
   *  failed row's `meta.clientMessageId`) — the transport re-queues the tracked
   *  pending send with the SAME id so the DO's send-idempotency dedups any copy
   *  that already landed. Returns false for an unknown id (already acked/
   *  reconciled). ChatShell wires this to MessageItemDefault's failed-bubble
   *  retry affordance by default. */
  retrySend: (clientMessageId: string) => boolean;
  /** Returns whether the ack frame was sent (false on a closed socket) so the caller advances its local cursor only on success (M2). */
  readAck: (readSeq: number, focused: boolean) => boolean;
  signalTyping: () => void;
  /** Watched-only presence (R14): the UI subscribes ONLY while a member-list / online
   *  indicator is open, and unsubscribes when it closes, so an unwatched channel runs
   *  zero presence alarms. `presence` stays empty until subscribed. */
  presenceSubscribe: () => void;
  presenceUnsubscribe: () => void;
};

export function useRealtimeChatMessages(client: RealtimeChatClient): UseRealtimeChatMessagesResult {
  const [state, setState] = React.useState<ChannelClientState>(() => client.getState());

  // Subscribe only; the owning hook drives connect/close (single lifecycle owner, C-B7).
  // Re-subscribes on client identity change (auth-user switch).
  React.useEffect(() => {
    const unsub = client.subscribe(setState);
    setState(client.getState());
    return unsub;
  }, [client]);

  // Pre-warm the name cache for visible senders (parity with the firestore hook).
  const resolverCtx = useOptionalChatNameResolver();
  const senderIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of state.messages) {
      set.add(m.senderId);
      if (m.replyTo?.senderId) set.add(m.replyTo.senderId);
    }
    return Array.from(set);
  }, [state.messages]);

  React.useEffect(() => {
    if (resolverCtx?.prewarm && senderIds.length > 0) resolverCtx.prewarm(senderIds);
  }, [resolverCtx, senderIds]);

  const fetchOlder = React.useCallback(async () => {
    client.channel.fetchOlder();
  }, [client]);

  const send = React.useCallback(
    (text: string, replyTo?: { messageSeq: number; preview: string } | null): boolean =>
      client.channel.send({ clientMessageId: makeClientMessageId(), text, replyTo: replyTo ?? null }),
    [client],
  );

  const retrySend = React.useCallback(
    (clientMessageId: string): boolean => client.channel.retrySend(clientMessageId),
    [client],
  );

  const readAck = React.useCallback(
    (readSeq: number, focused: boolean) => client.channel.readAck(readSeq, focused),
    [client],
  );

  const signalTyping = React.useCallback(() => client.channel.typing(), [client]);
  const presenceSubscribe = React.useCallback(() => client.channel.presenceSubscribe(), [client]);
  const presenceUnsubscribe = React.useCallback(() => client.channel.presenceUnsubscribe(), [client]);

  return {
    // On the realtime transport DATA ACCESS is enforced by the DO grant, so the
    // hook is always "allowed" client-side (the socket simply won't open / will be
    // closed 4403 if the grant is denied) — accessMode is presentation-only here.
    allowed: true,
    isInitialLoading: state.status === "connecting" || state.status === "idle",
    messages: state.messages,
    fetchOlder,
    hasOlder: state.hasOlder,
    isFetchingOlder: state.isFetchingOlder,
    status: state.status,
    lastErrorCode: state.lastErrorCode,
    typing: state.typing,
    presence: state.presence,
    send,
    retrySend,
    readAck,
    signalTyping,
    presenceSubscribe,
    presenceUnsubscribe,
  };
}

/** A client message id for optimistic-send idempotency (SQLite unique (senderUid, clientMessageId)). */
function makeClientMessageId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `cmid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
