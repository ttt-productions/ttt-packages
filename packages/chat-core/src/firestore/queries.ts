import type { Firestore, Query, DocumentData } from "firebase/firestore";
import { collection, query, orderBy, limit } from "firebase/firestore";

export function threadDocPath(chatCollection: string, threadId: string) {
  return [chatCollection, threadId] as const;
}

export function messagesColPath(chatCollection: string, threadId: string) {
  return [chatCollection, threadId, "messages"] as const;
}

export function newestWindowQuery(
  db: Firestore,
  chatCollection: string,
  threadId: string,
  createdAtField: string,
  pageSize: number
): Query<DocumentData> {
  return query(
    collection(db, ...messagesColPath(chatCollection, threadId)),
    orderBy(createdAtField, "desc"),
    limit(pageSize)
  );
}
