// Shared Firestore value primitives for the durable backend job/queue collections.
//
// TTT's app-wide convention stores timestamps as epoch-millis NUMBERS
// (Date.now()). The exception is the redesign's durable job/ledger collections
// (mediaActivationJobs, and the chat/notification queues): their time fields are
// real Firestore `Timestamp`s because Firestore's NATIVE TTL service only honors
// a Timestamp-typed field — an epoch-millis number is never expired. This is the
// frozen matrix rule ("All TTL fields are Firestore Timestamp, never epoch-millis").
//
// ttt-core is environment-neutral (shared by app + functions), so it must not
// import firebase-admin/firebase. We model a Timestamp STRUCTURALLY via z.custom,
// which validates WITHOUT transforming — a real Timestamp instance (Admin or
// client SDK) passes through unchanged, preserving its methods for downstream use.

import { z } from 'zod';

/** Structural shape of a Firestore Timestamp (both Admin and client SDK). */
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

/** A Firestore `Timestamp` value (validated structurally, passed through as-is). */
export const FirestoreTimestampSchema = z.custom<FirestoreTimestampLike>(isFirestoreTimestamp, {
  message: 'Expected a Firestore Timestamp',
});
