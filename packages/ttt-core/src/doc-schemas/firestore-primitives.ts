// Native TTL honors only a Timestamp-typed field, so a TTL field is the one Timestamp
// (RULE-STD-ARCH-105).
// ttt-core cannot import Firebase, so a Timestamp is checked structurally and passed through
// unchanged.

import { z } from 'zod';

export interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
  toMillis(): number;
  toDate(): Date;
}

function isFirestoreTimestamp(v: unknown): v is FirestoreTimestampLike {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.seconds === 'number' &&
    typeof t.nanoseconds === 'number' &&
    typeof t.toMillis === 'function'
  );
}

export const FirestoreTimestampSchema = z.custom<FirestoreTimestampLike>(isFirestoreTimestamp, {
  message: 'Expected a Firestore Timestamp',
});
