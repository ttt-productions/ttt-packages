import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const serverNow = () => FieldValue.serverTimestamp();

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
