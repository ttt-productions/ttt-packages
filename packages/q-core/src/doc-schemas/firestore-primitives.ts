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
