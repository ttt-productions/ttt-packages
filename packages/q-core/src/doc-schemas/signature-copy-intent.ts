// No native TTL: an intent removed before its kept copy is reaped strands that copy.

import { z } from 'zod';
import {
  countSchema,
  epochMsSchema,
  hardwareLoanContractIdSchema,
  leagueIdSchema,
  stagingIdSchema,
  userIdSchema,
} from './atoms.js';

export const SignatureCopyIntentStateSchema = z.enum(['copying', 'reaping']);
export type SignatureCopyIntentState = z.infer<typeof SignatureCopyIntentStateSchema>;

// The record whose `signatureFile` names the kept copy once the signing commits.
export const SignatureCopyRecordRefSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('signedWaiver'), leagueId: leagueIdSchema, userId: userIdSchema })
    .strict(),
  z
    .object({ kind: z.literal('hardwareLoanContract'), contractId: hardwareLoanContractIdSchema })
    .strict(),
]);
export type SignatureCopyRecordRef = z.infer<typeof SignatureCopyRecordRefSchema>;

export const SignatureCopyIntentSchema = z
  .object({
    stagingId: stagingIdSchema,
    stagingPath: z.string().min(1),
    keptPath: z.string().min(1),
    record: SignatureCopyRecordRefSchema,
    state: SignatureCopyIntentStateSchema,
    createdAt: epochMsSchema,
    updatedAt: epochMsSchema,
    reapAfter: epochMsSchema,
    reapAttemptCount: countSchema,
    reapClaimedAt: epochMsSchema.optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.keptPath.endsWith(`/${val.stagingId}`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['keptPath'],
        message: 'a kept copy is named for its own staging id',
      });
    }
    if (val.state === 'reaping' && val.reapClaimedAt === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reapClaimedAt'],
        message: 'a reaping intent records when it was claimed',
      });
    }
    if (val.state === 'copying' && val.reapClaimedAt !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reapClaimedAt'],
        message: 'a copying intent has not been claimed',
      });
    }
    if (val.reapAfter < val.updatedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['reapAfter'],
        message: 'an intent is never due before the write last recorded it',
      });
    }
  });
export type SignatureCopyIntent = z.infer<typeof SignatureCopyIntentSchema>;
