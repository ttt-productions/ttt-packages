// `sweepState/{sweepName}` — where a scheduled pass over a bounded, ordered source keeps its
// position (BACKEND-112), one document per `SWEEP_STATE_NAMES` name. Backend-only: no client reads
// or writes it.

import { z } from 'zod';
import { SWEEP_STATE_MAX_DEFERRED } from '../constants/scheduled-jobs.js';
import { epochMsSchema } from './atoms.js';

// Where a pass stands in its source.
//   absent — no lap has run: the next pass starts one at the beginning.
//   inLap  — the next page starts strictly after the last row the lap moved past. `afterKey` is
//            that row's document id; `afterValue` is its value of the numeric field the query
//            orders by first, when it orders by one. The query orders by the field and then by the
//            key and resumes after both, never `field > value`, which skips every row tied with it.
//   done   — the last lap reached the end of its source. The pass that exhausted it records that
//            here rather than starting page one again in the same run; the next pass starts a new
//            lap, so rows added behind the cursor are reached on the next lap.
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

// A row the cursor moved past without clearing it (a failed read or write). The pass retries it from
// here once it is due instead of stopping at it, so one failing row never pins the window (BACKEND-309).
export const SweepDeferredRowSchema = z
  .object({
    key: z.string().min(1),
    value: z.number().optional(),
    /** Epoch ms from which a pass may retry it. */
    nextAttemptAt: epochMsSchema,
    /** Passes that examined it without clearing it; the pass that deferred it is the first. */
    attemptCount: z.number().int().positive(),
  })
  .strict();
export type SweepDeferredRow = z.infer<typeof SweepDeferredRowSchema>;

export const SweepStateSchema = z
  .object({
    /** Wall-clock ms the last full sign-in account scan ran (absent = never). */
    fullScanLastRunAt: epochMsSchema.optional(),
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
