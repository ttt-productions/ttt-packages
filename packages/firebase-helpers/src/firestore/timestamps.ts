import { Timestamp, serverTimestamp } from "firebase/firestore";
// Re-export universal helpers
export * from "./timestamps-universal.js";

/** Firestore server timestamp (Client SDK) */
export const serverNow = () => serverTimestamp();

/** Convert Date -> Firestore Timestamp (Client SDK) */
export function dateToTs(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/** Convert ms since epoch -> Firestore Timestamp (Client SDK) */
export function msToTs(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

/** Safe convert (Client SDK specific typing) */
export function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts.toDate();
}