import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, Timestamp } from "firebase/firestore";

export type DocSnap<T> = DocumentSnapshot<T>;
export type QueryDocSnap<T> = QueryDocumentSnapshot<T>;

export type WithId<T> = T & { id: string };

export function withId<T extends DocumentData>(snap: QueryDocumentSnapshot<T>): WithId<T> {
  return { id: snap.id, ...snap.data() };
}

export type TimestampLike = Timestamp | Date | number; // number = ms since epoch
