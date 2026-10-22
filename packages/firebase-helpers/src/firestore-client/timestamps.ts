import { Timestamp, serverTimestamp } from 'firebase/firestore';

export const serverNow = () => serverTimestamp();

export function dateToTs(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

export function msToTs(ms: number): Timestamp {
  return Timestamp.fromMillis(ms);
}

export function tsToDate(ts?: Timestamp | null): Date | null {
  if (!ts) return null;
  return ts.toDate();
}
