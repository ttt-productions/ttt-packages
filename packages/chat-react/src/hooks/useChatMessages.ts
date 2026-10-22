'use client';

import * as React from 'react';
import type { DocumentData } from 'firebase/firestore';
import { toMillis } from '@ttt-productions/firebase-helpers';
import { useFirestoreLiveInfinite } from '@ttt-productions/query-core/react';
import type { FirestoreSourceState } from '@ttt-productions/query-core/types';
import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import type { ChatCoreConfig } from '../types.js';
import { messagesColPath } from '../firestore/queries.js';
import { useOptionalChatNameResolver } from '../context/ChatNameResolverContext.js';

const MAX_PAGE_SIZE = 100;

export type UseChatMessagesResult = {
  allowed: boolean;
  isInitialLoading: boolean;
  messages: ChatMessageV1[];
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  sourceState: FirestoreSourceState;
  error: Error | null;
  olderError: Error | null;
  retry: () => void;
};

function mapMsg(
  data: DocumentData & { id: string },
  threadId: string,
  messageMeta: ChatCoreConfig['messageMeta'],
): ChatMessageV1 {
  const d = data as any;

  const createdAt = toMillis(d.createdAt);

  if (!createdAt) {
    console.error('[useChatMessages] Message missing valid createdAt:', data.id, d.createdAt);
  }

  const appMeta = messageMeta?.(data);
  return {
    messageId: data.id,
    threadId,
    createdAt: createdAt || 0,
    senderId: d.senderId,
    text: d.text ?? '',
    type: d.type,
    isSystemMessage: d.isSystemMessage ?? undefined,
    referencedUids: Array.isArray(d.referencedUids) ? d.referencedUids : undefined,
    hidden: d.hidden ?? undefined,
    meta: appMeta ? { ...d.meta, ...appMeta } : d.meta,
  };
}

export function useChatMessages(config: ChatCoreConfig): UseChatMessagesResult {
  const {
    chatCollectionPath,
    messagesSubcollection = 'messages',
    threadId,
    pageSize: requestedPageSize = 20,
    currentUserId,
    allowed,
    createdAtField = 'createdAt',
    messageMeta,
  } = config;

  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  if (requestedPageSize > MAX_PAGE_SIZE) {
    console.warn(
      `[useChatMessages] Requested pageSize ${requestedPageSize} exceeds maximum ${MAX_PAGE_SIZE}. Using ${MAX_PAGE_SIZE}.`,
    );
  }

  const pathKey = React.useMemo(
    () =>
      JSON.stringify(Array.isArray(chatCollectionPath) ? chatCollectionPath : [chatCollectionPath]),
    [chatCollectionPath],
  );

  const collectionPath = React.useMemo(
    () => messagesColPath(chatCollectionPath, threadId, messagesSubcollection).join('/'),
    [chatCollectionPath, threadId, messagesSubcollection],
  );

  const {
    items,
    isInitialLoading,
    fetchOlder,
    hasOlder,
    isFetchingOlder,
    sourceState,
    error,
    olderError,
    retry,
  } = useFirestoreLiveInfinite<ChatMessageV1>({
    collectionPath,
    queryKey: [
      'chat-core',
      'messages',
      pathKey,
      threadId,
      messagesSubcollection,
      pageSize,
      currentUserId,
    ],
    orderByField: createdAtField,
    pageSize,
    enabled: allowed,
    sort: 'asc',
    select: (data) => mapMsg(data, threadId, messageMeta),
  });

  const messages = React.useMemo(() => (allowed ? items : []), [allowed, items]);

  const resolverCtx = useOptionalChatNameResolver();
  const senderIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of messages) {
      set.add(m.senderId);
      for (const uid of m.referencedUids ?? []) set.add(uid);
    }
    return Array.from(set);
  }, [messages]);

  React.useEffect(() => {
    if (resolverCtx?.prewarm && senderIds.length > 0) {
      resolverCtx.prewarm(senderIds);
    }
  }, [resolverCtx, senderIds]);

  return {
    allowed,
    isInitialLoading: allowed ? isInitialLoading : false,
    messages,
    fetchOlder,
    hasOlder,
    isFetchingOlder,
    sourceState,
    error: allowed ? error : null,
    olderError: allowed ? olderError : null,
    retry,
  };
}
