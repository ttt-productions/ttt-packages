import type { DocumentData, DocumentSnapshot, QueryDocumentSnapshot, Timestamp } from "firebase/firestore";

export type DocSnap<T> = DocumentSnapshot<T>;
export type QueryDocSnap<T> = QueryDocumentSnapshot<T>;

export type WithId<T> = T & { id: string };

export function withId<T extends DocumentData>(snap: QueryDocumentSnapshot<T>): WithId<T> {
  return { id: snap.id, ...snap.data() };
}

/**
 * Serialized Firestore Timestamp format.
 * This is what you get when a Timestamp is JSON-serialized from Cloud Functions.
 */
export interface SerializedTimestamp {
  _seconds: number;
  _nanoseconds: number;
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

/**
 * Type guard: checks if value is a SerializedTimestamp from Cloud Functions
 */
export function isSerializedTimestamp(value: unknown): value is SerializedTimestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in value &&
    "_nanoseconds" in value &&
    typeof (value as SerializedTimestamp)._seconds === "number" &&
    typeof (value as SerializedTimestamp)._nanoseconds === "number"
  );
}

/**
 * Type guard: checks if value has a toDate() method (duck typing for Timestamp)
 */
export function hasToDateMethod(value: unknown): value is { toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  );
}
