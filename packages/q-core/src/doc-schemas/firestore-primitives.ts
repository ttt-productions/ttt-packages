// Structural model of a Firestore Timestamp, so this package imports neither Firebase SDK.
//
// Every persisted moment is an epoch-millisecond number (ARCH-105), except a field a native-TTL
// policy reads — the admin notification documents' `expireAt` — which the service honours only on a
// real Timestamp.

import { z } from 'zod';

export interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
  toMillis(): number;
  toDate(): Date;
}

function isFirestoreTimestamp(value: unknown): value is FirestoreTimestampLike {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<FirestoreTimestampLike>;
  return (
    typeof candidate.seconds === 'number' &&
    typeof candidate.nanoseconds === 'number' &&
    typeof candidate.toMillis === 'function' &&
    typeof candidate.toDate === 'function'
  );
}

// z.custom validates without transforming, so a real Timestamp passes through with its methods.
export const FirestoreTimestampSchema = z.custom<FirestoreTimestampLike>(isFirestoreTimestamp, {
  message: 'Expected a Firestore Timestamp',
});
