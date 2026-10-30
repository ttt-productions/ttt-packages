import { z } from 'zod';
import { SWEEP_STATE_MAX_DEFERRED } from '../constants/scheduled-jobs.js';
import { epochMsSchema } from './atoms.js';

// The query orders by the field and then by the key and resumes after both, never
// `field > value`, which skips every row tied with it.
export const SweepRollingCursorSchema = z
  .discriminatedUnion('state', [
    z
      .object({
        state: z.literal('inLap'),
        afterKey: z.string().min(1),
        afterValue: z.number().optional(),
        lapStartedAt: epochMsSchema,
      })
      .strict(),
    z
      .object({
        state: z.literal('done'),
        lapStartedAt: epochMsSchema,
        lapCompletedAt: epochMsSchema,
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (value.state === 'done' && value.lapCompletedAt < value.lapStartedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['lapCompletedAt'],
        message: 'a lap completes no earlier than it started',
      });
    }
  });
export type SweepRollingCursor = z.infer<typeof SweepRollingCursorSchema>;

export const SweepDeferredRowSchema = z
  .object({
    key: z.string().min(1),
    value: z.number().optional(),
    nextAttemptAt: epochMsSchema,
    attemptCount: z.number().int().positive(),
  })
  .strict();
export type SweepDeferredRow = z.infer<typeof SweepDeferredRowSchema>;

// Firebase Auth lists accounts only by page token, with no key to resume after; a token it no
// longer accepts restarts the lap.
export const SweepAuthScanLapSchema = z
  .object({
    pageToken: z.string().min(1),
    lapStartedAt: epochMsSchema,
  })
  .strict();
export type SweepAuthScanLap = z.infer<typeof SweepAuthScanLapSchema>;

export const SweepStateSchema = z
  .object({
    fullScanLastRunAt: epochMsSchema.optional(),
    fullScanLap: SweepAuthScanLapSchema.optional(),
    rollingCursor: SweepRollingCursorSchema.optional(),
    deferred: z.array(SweepDeferredRowSchema).max(SWEEP_STATE_MAX_DEFERRED).optional(),
    updatedAt: epochMsSchema,
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    (value.deferred ?? []).forEach((row, index) => {
      if (seen.has(row.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['deferred', index, 'key'],
          message: 'a row is deferred at most once',
        });
      }
      seen.add(row.key);
    });
  });
export type SweepState = z.infer<typeof SweepStateSchema>;
