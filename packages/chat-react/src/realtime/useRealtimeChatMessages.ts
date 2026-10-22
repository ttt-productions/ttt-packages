'use client';

import * as React from 'react';
import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import type { RealtimeChatClient } from './transport.js';
import type { ChannelClientState } from './channel-client.js';
import { useOptionalChatNameResolver } from '../context/ChatNameResolverContext.js';
import { newCorrelationId } from './shared.js';

export type UseRealtimeChatMessagesResult = {
  allowed: boolean;
  isInitialLoading: boolean;
  messages: ChatMessageV1[];
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  initialLoadFailed: boolean;
  isSynced: boolean;
  retry: () => void;
  status: ChannelClientState['status'];
  lastErrorCode: string | null;
  typing: string[];
  presence: string[];
  send: (text: string) => boolean;
  retrySend: (clientMessageId: string) => boolean;
  readAck: (readSeq: number, focused: boolean) => boolean;
  signalTyping: () => void;
  presenceSubscribe: () => void;
  presenceUnsubscribe: () => void;
};

export function useRealtimeChatMessages(client: RealtimeChatClient): UseRealtimeChatMessagesResult {
  const [state, setState] = React.useState<ChannelClientState>(() => client.getState());

  React.useEffect(() => {
    const unsub = client.subscribe(setState);
    setState(client.getState());
    return unsub;
  }, [client]);

  const resolverCtx = useOptionalChatNameResolver();
  const senderIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of state.messages) {
      set.add(m.senderId);
      for (const uid of m.referencedUids ?? []) set.add(uid);
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
    (text: string): boolean => client.channel.send({ clientMessageId: newCorrelationId(), text }),
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
  const retry = React.useCallback(() => client.retry(), [client]);
  const presenceSubscribe = React.useCallback(() => client.channel.presenceSubscribe(), [client]);
  const presenceUnsubscribe = React.useCallback(
    () => client.channel.presenceUnsubscribe(),
    [client],
  );

  return {
    allowed: state.lastErrorCode !== 'access-denied',
    isInitialLoading: !state.hasLoadedInitialData,
    initialLoadFailed: state.initialLoadFailed,
    isSynced: state.isSynced,
    retry,
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
