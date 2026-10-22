import type {
  DocumentData,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import type { SerializedTimestamp, WithId } from '../firestore/types.js';

export type DocSnap<T> = DocumentSnapshot<T>;
export type QueryDocSnap<T> = QueryDocumentSnapshot<T>;

export function withId<T extends DocumentData>(snap: QueryDocumentSnapshot<T>): WithId<T> {
  return { id: snap.id, ...snap.data() };
}

export type TimestampLike = Timestamp | Date | number | SerializedTimestamp | string;
