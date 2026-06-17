"use client";

// React hook for the REALTIME transport, returning the SAME shape as
// `useChatMessages` (the firestore path) so `ChatShell` is transport-agnostic.
// It subscribes to a `RealtimeChatClient`'s observable state, connects on mount,
// and tears every socket down on unmount OR when the auth user switches
// (Contract A: auth-user switch tears down every socket before connecting as the
// new uid). The client instance is owned by the caller (passed via config) so its
// identity is the teardown key — a new client for a new uid replaces the old one.

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
  typing: string[];
  presence: string[];
  send: (text: string, replyTo?: { messageSeq: number; preview: string } | null) => void;
  readAck: (readSeq: number, focused: boolean) => void;
  signalTyping: () => void;
};

export function useRealtimeChatMessages(client: RealtimeChatClient): UseRealtimeChatMessagesResult {
  const [state, setState] = React.useState<ChannelClientState>(() => client.getState());

  // Subscribe + connect; tear down on client identity change (auth-user switch) or unmount.
  React.useEffect(() => {
    const unsub = client.subscribe(setState);
    setState(client.getState());
    void client.connect();
    return () => {
      unsub();
      client.close();
    };
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
    (text: string, replyTo?: { messageSeq: number; preview: string } | null) => {
      client.channel.send({ clientMessageId: makeClientMessageId(), text, replyTo: replyTo ?? null });
    },
    [client],
  );

  const readAck = React.useCallback(
    (readSeq: number, focused: boolean) => client.channel.readAck(readSeq, focused),
    [client],
  );

  const signalTyping = React.useCallback(() => client.channel.typing(), [client]);

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
    typing: state.typing,
    presence: state.presence,
    send,
    readAck,
    signalTyping,
  };
}

/** A client message id for optimistic-send idempotency (SQLite unique (senderUid, clientMessageId)). */
function makeClientMessageId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `cmid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
