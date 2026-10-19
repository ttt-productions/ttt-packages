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

/**
 * All possible timestamp-like values that can be converted.
 * - Timestamp: Native Firestore Timestamp
 * - Date: JavaScript Date object  
 * - number: Milliseconds since epoch
 * - SerializedTimestamp: JSON-serialized Timestamp from backend
 * - string: ISO date string
 */
export type TimestampLike = Timestamp | Date | number | SerializedTimestamp | string;
