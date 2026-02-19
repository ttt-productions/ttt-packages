import type { Firestore, Query, DocumentData } from "firebase/firestore";
import { collection, query, orderBy, limit } from "firebase/firestore";

function normalizeSegments(path: string | string[]): string[] {
  return Array.isArray(path) ? path : [path];
}

export function threadDocPath(chatCollectionPath: string | string[], threadId: string): string[] {
  return [...normalizeSegments(chatCollectionPath), threadId];
}

export function messagesColPath(
  chatCollectionPath: string | string[],
  threadId: string,
  messagesSubcollection = "messages"
): [string, string, ...string[]] {
  const segments = [...normalizeSegments(chatCollectionPath), threadId, messagesSubcollection];
  return segments as [string, string, ...string[]];
}

export function newestWindowQuery(
  db: Firestore,
  chatCollectionPath: string | string[],
  threadId: string,
  createdAtField: string,
  pageSize: number,
  messagesSubcollection = "messages"
): Query<DocumentData> {
  const path = messagesColPath(chatCollectionPath, threadId, messagesSubcollection);
  return query(
    collection(db, path[0], ...path.slice(1)),
    orderBy(createdAtField, "desc"),
    limit(pageSize)
  );
}