"use client";

import * as React from "react";
import type {
  DocumentData,
  QueryDocumentSnapshot,
  Firestore,
} from "firebase/firestore";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  limit,
} from "firebase/firestore";
import { useInfiniteQuery } from "@tanstack/react-query";
import { toMillis } from "@ttt-productions/firebase-helpers";
import type { ChatCoreConfig, ChatMessageV1 } from "../types";
import { canAccessThread } from "./useChatThreadAccess";
import { messagesColPath, newestWindowQuery } from "../firestore/queries";

// Safety limit to prevent memory exhaustion
const MAX_PAGE_SIZE = 100;

type NewestWindowState = {
  ready: boolean;
  newestDesc: ChatMessageV1[];
  oldestDocInWindow: QueryDocumentSnapshot<DocumentData> | null;
};

export type UseChatMessagesResult = {
  allowed: boolean;
  isInitialLoading: boolean;
  messages: ChatMessageV1[];
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
};

function mapMsg(
  doc: QueryDocumentSnapshot<DocumentData>,
  threadId: string
): ChatMessageV1 {
  const d = doc.data() as any;

  const createdAt = toMillis(d.createdAt);

  if (!createdAt) {
    console.error('[useChatMessages] Message missing valid createdAt:', doc.id, d.createdAt);
  }

  return {
    messageId: doc.id,
    threadId,
    createdAt: createdAt || 0,
    senderId: d.senderId,
    senderUsername: d.senderUsername,
    text: d.text ?? "",
    type: d.type,
    attachment: d.attachment ?? undefined,
    replyTo: d.replyTo ?? undefined,
    isSystemMessage: d.isSystemMessage ?? undefined,
    meta: d.meta,
  };
}

function dedupeAndSortAsc(all: ChatMessageV1[]) {
  const m = new Map<string, ChatMessageV1>();
  for (const x of all) m.set(x.messageId, x);
  return Array.from(m.values()).sort((a, b) => a.createdAt - b.createdAt);
}

function messagesCol(
  db: Firestore,
  chatCollectionPath: string | string[],
  threadId: string,
  messagesSubcollection: string
) {
  const path = messagesColPath(chatCollectionPath, threadId, messagesSubcollection);
  return collection(db, path[0], ...path.slice(1));
}

export function useChatMessages(config: ChatCoreConfig): UseChatMessagesResult {
  const {
    db,
    chatCollectionPath,
    messagesSubcollection = "messages",
    threadId,
    pageSize: requestedPageSize = 20,
    currentUserId,
    isAdmin,
    threadAllowedUserIds,
    createdAtField = "createdAt",
  } = config;

  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  if (requestedPageSize > MAX_PAGE_SIZE) {
    console.warn(
      `[useChatMessages] Requested pageSize ${requestedPageSize} exceeds maximum ${MAX_PAGE_SIZE}. Using ${MAX_PAGE_SIZE}.`
    );
  }

  const pathKey = JSON.stringify(
    Array.isArray(chatCollectionPath) ? chatCollectionPath : [chatCollectionPath]
  );

  const allowed = React.useMemo(
    () =>
      canAccessThread({
        isAdmin,
        currentUserId,
        allowedUserIds: threadAllowedUserIds,
      }),
    [isAdmin, currentUserId, threadAllowedUserIds]
  );

  const [newest, setNewest] = React.useState<NewestWindowState>({
    ready: false,
    newestDesc: [],
    oldestDocInWindow: null,
  });

  React.useEffect(() => {
    if (!allowed) return;

    const q = newestWindowQuery(
      db,
      chatCollectionPath,
      threadId,
      createdAtField,
      pageSize,
      messagesSubcollection
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs as QueryDocumentSnapshot<DocumentData>[];
      const mapped = docs.map((d) => mapMsg(d, threadId));
      setNewest({
        ready: true,
        newestDesc: mapped,
        oldestDocInWindow: docs[docs.length - 1] ?? null,
      });
    });

    return () => unsub();
  }, [allowed, db, pathKey, threadId, createdAtField, pageSize, messagesSubcollection]);

  const older = useInfiniteQuery({
    queryKey: ["chat-core", "older", pathKey, threadId, messagesSubcollection, pageSize],
    enabled: allowed && newest.ready,
    initialPageParam: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
    queryFn: async ({ pageParam }) => {
      const baseCol = messagesCol(db, chatCollectionPath, threadId, messagesSubcollection);

      const cursor =
        pageParam ?? (newest.oldestDocInWindow ?? undefined);

      if (!cursor) {
        return {
          itemsDesc: [] as ChatMessageV1[],
          nextCursor: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
        };
      }

      const q = query(
        baseCol,
        orderBy(createdAtField, "desc"),
        startAfter(cursor),
        limit(pageSize)
      );

      const snap = await getDocs(q);
      const docs = snap.docs as QueryDocumentSnapshot<DocumentData>[];

      const itemsDesc = docs.map((d) => mapMsg(d, threadId));
      const nextCursor =
        docs.length === pageSize ? docs[docs.length - 1] : undefined;

      return { itemsDesc, nextCursor };
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  const fetchOlder = React.useCallback(async () => {
    await older.fetchNextPage();
  }, [older.fetchNextPage]);

  const messages = React.useMemo(() => {
    if (!allowed) return [];
    const olderDesc = (older.data?.pages ?? []).flatMap((p) => p.itemsDesc);
    return dedupeAndSortAsc([...olderDesc, ...newest.newestDesc]);
  }, [allowed, older.data, newest.newestDesc]);

  return {
    allowed,
    isInitialLoading: allowed ? !newest.ready : false,
    messages,
    fetchOlder,
    hasOlder: Boolean(older.hasNextPage),
    isFetchingOlder: older.isFetchingNextPage,
  };
}