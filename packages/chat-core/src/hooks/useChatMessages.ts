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
  
  // CRITICAL FIX: Do not fallback to Date.now().
  // If data is missing/corrupt, use 0 so it sorts to the beginning (oldest) 
  // rather than appearing as a brand new message.
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
    text: d.message ?? d.text ?? "",
    type: d.type,
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
  chatCollection: string,
  threadId: string
) {
  return collection(db, ...messagesColPath(chatCollection, threadId));
}

export function useChatMessages(config: ChatCoreConfig): UseChatMessagesResult {
  const {
    db,
    chatCollection,
    threadId,
    pageSize: requestedPageSize = 20,
    currentUserId,
    isAdmin,
    threadAllowedUserIds,
    createdAtField = "createdAt",
  } = config;

  // SAFETY FIX: Clamp page size
  const pageSize = Math.min(requestedPageSize, MAX_PAGE_SIZE);

  if (requestedPageSize > MAX_PAGE_SIZE) {
    console.warn(
      `[useChatMessages] Requested pageSize ${requestedPageSize} exceeds maximum ${MAX_PAGE_SIZE}. Using ${MAX_PAGE_SIZE}.`
    );
  }

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

  // realtime newest window only
  React.useEffect(() => {
    if (!allowed) return;

    const q = newestWindowQuery(
      db,
      chatCollection,
      threadId,
      createdAtField,
      pageSize
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs as QueryDocumentSnapshot<DocumentData>[];
      const mapped = docs.map((d) => mapMsg(d, threadId)); // desc
      setNewest({
        ready: true,
        newestDesc: mapped,
        oldestDocInWindow: docs[docs.length - 1] ?? null,
      });
    });

    return () => unsub();
  }, [allowed, db, chatCollection, threadId, createdAtField, pageSize]);

  // older pagination (beyond newest window)
  const older = useInfiniteQuery({
    queryKey: ["chat-core", "older", chatCollection, threadId, pageSize],
    enabled: allowed && newest.ready,
    initialPageParam: undefined as QueryDocumentSnapshot<DocumentData> | undefined,
    queryFn: async ({ pageParam }) => {
      const baseCol = messagesCol(db, chatCollection, threadId);

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

      const itemsDesc = docs.map((d) => mapMsg(d, threadId)); // desc
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
    // Filter out any messages with 0 timestamp (invalid) if desired, 
    // or keep them (they will sort to top). 
    // For now we keep them to avoid data loss holes, but they won't look "new".
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