"use client";

import * as React from "react";
import type { DocumentData } from "firebase/firestore";
import { toMillis } from "@ttt-productions/firebase-helpers";
import { useFirestoreLiveInfinite } from "@ttt-productions/query-core/react";
import type { ChatMessageV1 } from "@ttt-productions/chat-core";
import type { ChatCoreConfig } from "../types.js";
import { canAccessThread } from "./useChatThreadAccess.js";
import { messagesColPath } from "../firestore/queries.js";
import { useOptionalChatNameResolver } from "../context/ChatNameResolverContext.js";

// Safety limit to prevent memory exhaustion
const MAX_PAGE_SIZE = 100;

export type UseChatMessagesResult = {
  allowed: boolean;
  isInitialLoading: boolean;
  messages: ChatMessageV1[];
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
};

function mapMsg(
  data: DocumentData & { id: string },
  threadId: string
): ChatMessageV1 {
  const d = data as any;

  const createdAt = toMillis(d.createdAt);

  if (!createdAt) {
    console.error('[useChatMessages] Message missing valid createdAt:', data.id, d.createdAt);
  }

  // replyTo: the new shape uses senderId, not senderUsername. Tolerate older
  // docs that still have senderUsername — drop the name and keep what we can.
  const replyTo = d.replyTo
    ? {
        messageId: d.replyTo.messageId,
        senderId: d.replyTo.senderId ?? "",
        messagePreview: d.replyTo.messagePreview,
      }
    : undefined;

  return {
    messageId: data.id,
    threadId,
    createdAt: createdAt || 0,
    senderId: d.senderId,
    text: d.text ?? "",
    type: d.type,
    attachment: d.attachment ?? undefined,
    replyTo,
    isSystemMessage: d.isSystemMessage ?? undefined,
    meta: d.meta,
  };
}

export function useChatMessages(config: ChatCoreConfig): UseChatMessagesResult {
  const {
    chatCollectionPath,
    messagesSubcollection = "messages",
    threadId,
    pageSize: requestedPageSize = 20,
    currentUserId,
    isAdmin,
    accessMode,
    threadAllowedUserIds,
    createdAtField = "createdAt",
  } = config;

  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  if (requestedPageSize > MAX_PAGE_SIZE) {
    console.warn(
      `[useChatMessages] Requested pageSize ${requestedPageSize} exceeds maximum ${MAX_PAGE_SIZE}. Using ${MAX_PAGE_SIZE}.`
    );
  }

  const allowed = React.useMemo(
    () =>
      canAccessThread({
        accessMode,
        isAdmin,
        currentUserId,
        allowedUserIds: threadAllowedUserIds,
      }),
    [accessMode, isAdmin, currentUserId, threadAllowedUserIds]
  );

  // Stable key segment for the message collection path (string | string[]).
  const pathKey = React.useMemo(
    () =>
      JSON.stringify(
        Array.isArray(chatCollectionPath) ? chatCollectionPath : [chatCollectionPath]
      ),
    [chatCollectionPath]
  );

  // Slash-joined collection path for the generic hook (handles nested paths).
  const collectionPath = React.useMemo(
    () => messagesColPath(chatCollectionPath, threadId, messagesSubcollection).join("/"),
    [chatCollectionPath, threadId, messagesSubcollection]
  );

  const { items, isInitialLoading, fetchOlder, hasOlder, isFetchingOlder } =
    useFirestoreLiveInfinite<ChatMessageV1>({
      collectionPath,
      queryKey: ["chat-core", "messages", pathKey, threadId, messagesSubcollection, pageSize],
      orderByField: createdAtField,
      pageSize,
      enabled: allowed,
      sort: "asc",
      select: (data) => mapMsg(data, threadId),
      getSortValue: (data) => toMillis(data.createdAt) ?? 0,
    });

  const messages = React.useMemo(() => (allowed ? items : []), [allowed, items]);

  // Pre-warm name cache for all visible senders (and reply-to senders).
  // Optional resolver: silent no-op if no provider is wrapped.
  const resolverCtx = useOptionalChatNameResolver();
  const senderIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of messages) {
      set.add(m.senderId);
      if (m.replyTo?.senderId) set.add(m.replyTo.senderId);
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
  };
}