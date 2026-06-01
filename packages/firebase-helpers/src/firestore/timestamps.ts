// Client-SDK Timestamp helpers. Reachable only via the
// "@ttt-productions/firebase-helpers/firestore-client" subpath — NOT from the
// pure root. Pure timestamp normalization (toMillis/toDate/now/…) lives in
// ./timestamps-universal.js and is exported from the root.
import { Timestamp, serverTimestamp } from "firebase/firestore";

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