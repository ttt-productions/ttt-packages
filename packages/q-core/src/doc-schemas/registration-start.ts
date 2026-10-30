// `expireAt` is a Timestamp, not epoch ms: Firestore's native TTL removes the document by it
// (RULE-STD-ARCH-105's exception).

import { z } from 'zod';
import { epochMsSchema, userIdSchema } from './atoms.js';
import { FirestoreTimestampSchema } from './firestore-primitives.js';

export const RegistrationStartSchema = z
  .object({
    userId: userIdSchema,
    startedAt: epochMsSchema,
    expireAt: FirestoreTimestampSchema,
  })
  .strict();
export type RegistrationStart = z.infer<typeof RegistrationStartSchema>;
