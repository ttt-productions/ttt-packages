// `registrationStarts/{userId}` — the record that a login's registration started: written by
// `createRegistrationStart` right after the login is created, before `registerUser`. It is the
// orphan-login cleanup's work list: a login whose registration started more than the grace window
// ago and still holds no profile was abandoned. Backend-only; no client reads or writes it. Its
// `expireAt` is the native-TTL field that removes it (RULE-STD-ARCH-105's exception).

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
