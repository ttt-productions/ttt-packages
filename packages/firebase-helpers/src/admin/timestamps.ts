import { Timestamp, FieldValue } from "firebase-admin/firestore";
// Re-export universal helpers
export * from "../firestore/timestamps-universal.js";

/** Firestore server timestamp (Admin SDK) */
export const serverNow = () => FieldValue.serverTimestamp();

/** Convert Date -> Firestore Timestamp (Admin SDK) */
export function dateToTs(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/** Convert ms since epoch -> Firestore Timestamp (Admin SDK) */
export function msToTs(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

/** Safe convert (Admin SDK specific typing) */
export function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts.toDate();
}