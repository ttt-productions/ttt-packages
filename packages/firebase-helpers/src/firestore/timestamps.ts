import { Timestamp, serverTimestamp } from "firebase/firestore";
import type { TimestampLike } from "./types";

/** Firestore server timestamp field value */
export const serverNow = () => serverTimestamp();

/** Convert Firestore Timestamp -> JS Date (safe for undefined/null) */
export function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts.toDate();
}

/** Convert Date -> Firestore Timestamp */
export function dateToTs(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/** Convert ms since epoch -> Firestore Timestamp */
export function msToTs(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

/** Convert Firestore Timestamp | Date | ms -> ms since epoch */
export function toMillis(value: TimestampLike): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return value;
}

/** Convert Firestore Timestamp | Date | ms -> JS Date */
export function toDate(value: TimestampLike): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}
