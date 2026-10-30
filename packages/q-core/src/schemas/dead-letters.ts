import { z } from 'zod';
import {
  countSchema,
  documentIdSegmentSchema,
  epochMsSchema,
  repairReasonSchema,
} from '../doc-schemas/atoms.js';

export const DEAD_LETTER_COLLECTION_KEYS = ['notificationDeliveries'] as const;
export const DeadLetterCollectionSchema = z.enum(DEAD_LETTER_COLLECTION_KEYS);
export type DeadLetterCollection = z.infer<typeof DeadLetterCollectionSchema>;

export const DEAD_LETTER_COLLECTION_LABELS: { readonly [K in DeadLetterCollection]: string } = {
  notificationDeliveries: 'Admin notification delivery',
};

export const MAX_DEAD_LETTERS_LISTED = 200;

export const GetDeadLettersInputSchema = z
  .object({
    collection: DeadLetterCollectionSchema.optional(),
    limit: z.number().int().min(1).max(MAX_DEAD_LETTERS_LISTED).optional(),
  })
  .strict()
  .nullish();
export type GetDeadLettersInput = z.infer<typeof GetDeadLettersInputSchema>;

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

export const GetDeadLettersResultSchema = z
  .object({
    generatedAt: epochMsSchema,
    rows: z.array(DeadLetterRowSchema),
    truncated: z.boolean(),
  })
  .strict();
export type GetDeadLettersResult = z.infer<typeof GetDeadLettersResultSchema>;

export const AdminReplayDeadLetterInputSchema = z
  .object({
    collection: DeadLetterCollectionSchema,
    docId: documentIdSegmentSchema,
    reason: repairReasonSchema,
    dryRun: z.boolean().optional(),
  })
  .strict();
export type AdminReplayDeadLetterInput = z.infer<typeof AdminReplayDeadLetterInputSchema>;

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
