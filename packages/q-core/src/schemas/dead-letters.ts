// Callable contracts for the operator's dead letters: the read-only list of the durable rows every
// supported pipeline stopped retrying, and the replay that puts one back to work after the cause is
// fixed. The replay is a repair, so it takes the admin's reason (BACKEND-212). The caller names a lane
// and a row id, never a Firestore path: the backend's lane registry derives the document from them
// (ARCH-106).

import { z } from 'zod';
import {
  countSchema,
  documentIdSegmentSchema,
  epochMsSchema,
  repairReasonSchema,
} from '../doc-schemas/atoms.js';

/** Every ledger the dead-letter replay supports. */
export const DEAD_LETTER_COLLECTION_KEYS = ['notificationDeliveries'] as const;
export const DeadLetterCollectionSchema = z.enum(DEAD_LETTER_COLLECTION_KEYS);
export type DeadLetterCollection = z.infer<typeof DeadLetterCollectionSchema>;

/** What the operator's screen calls each lane, beside its raw collection id. */
export const DEAD_LETTER_COLLECTION_LABELS: { readonly [K in DeadLetterCollection]: string } = {
  notificationDeliveries: 'Admin notification delivery',
};

/** The most rows the list returns per lane. */
export const MAX_DEAD_LETTERS_LISTED = 200;

// The list: every lane, or one; at most `limit` rows per lane, under the callable's own ceiling.
export const GetDeadLettersInputSchema = z
  .object({
    collection: DeadLetterCollectionSchema.optional(),
    limit: z.number().int().min(1).max(MAX_DEAD_LETTERS_LISTED).optional(),
  })
  .strict()
  .nullish();
export type GetDeadLettersInput = z.infer<typeof GetDeadLettersInputSchema>;

// One parked row, a projection over the lanes' own row shapes: each names its dead-letter time, last
// error, and attempts in its own fields, and the list maps them onto these.
export const DeadLetterRowSchema = z
  .object({
    collection: DeadLetterCollectionSchema,
    docId: z.string().min(1),
    deadLetteredAt: epochMsSchema.nullable(),
    lastError: z.string().nullable(),
    attemptCount: countSchema.nullable(),
  })
  .strict();
export type DeadLetterRow = z.infer<typeof DeadLetterRowSchema>;

// `truncated` is true when any lane hit the row cap: more parked rows exist than shown.
export const GetDeadLettersResultSchema = z
  .object({ generatedAt: epochMsSchema, rows: z.array(DeadLetterRowSchema), truncated: z.boolean() })
  .strict();
export type GetDeadLettersResult = z.infer<typeof GetDeadLettersResultSchema>;

// `dryRun` inspects the row — its status, and what a replay would reset it to — and writes nothing.
export const AdminReplayDeadLetterInputSchema = z
  .object({
    collection: DeadLetterCollectionSchema,
    docId: documentIdSegmentSchema,
    reason: repairReasonSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();
export type AdminReplayDeadLetterInput = z.infer<typeof AdminReplayDeadLetterInputSchema>;

// A performed replay answers `replayed` and the active value the row was reset to; a dry run answers
// `dryRun`, the row's current status, and what a replay would reset it to.
export const AdminReplayDeadLetterResultSchema = z
  .object({
    collection: DeadLetterCollectionSchema,
    docId: z.string().min(1),
    replayed: z.literal(true).optional(),
    resetTo: z.string().optional(),
    dryRun: z.literal(true).optional(),
    currentStatus: z.unknown().optional(),
    wouldResetTo: z.string().optional(),
  })
  .strict();
export type AdminReplayDeadLetterResult = z.infer<typeof AdminReplayDeadLetterResultSchema>;
