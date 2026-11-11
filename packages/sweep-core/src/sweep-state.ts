import { z } from 'zod';

export const SWEEP_STATE_MAX_DEFERRED = 50;

// The most Firebase Auth `listUsers()` returns in one call.
export const AUTH_LIST_USERS_PAGE_SIZE = 1000;

export const AUTH_FULL_SCAN_EXAMINED_PER_RUN = 2 * AUTH_LIST_USERS_PAGE_SIZE;

const sweepTimeSchema = z.number().int().nonnegative();

export interface SweepPosition {
  readonly key: string;
  readonly value?: number | null;
}

// Resume with startAfter(afterValue, afterKey), never `field > afterValue`: rows can share a value.
// A null value is a position too: Firestore orders null before every number.
export const SweepRollingCursorSchema = z
  .discriminatedUnion('state', [
    z.object({
      state: z.literal('inLap'),
      afterKey: z.string().min(1),
      afterValue: z.number().nullable().optional(),
      lapStartedAt: sweepTimeSchema,
    }),
    z.object({
      state: z.literal('done'),
      lapStartedAt: sweepTimeSchema,
      lapCompletedAt: sweepTimeSchema,
    }),
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

export const SweepDeferredRowSchema = z.object({
  key: z.string().min(1),
  value: z.number().nullable().optional(),
  nextAttemptAt: sweepTimeSchema,
  attemptCount: z.number().int().positive(),
});
export type SweepDeferredRow = z.infer<typeof SweepDeferredRowSchema>;

// Firebase Auth lists accounts only by page token, with no key to resume after; a token it no
// longer accepts restarts the lap.
export const SweepAuthScanLapSchema = z.object({
  pageToken: z.string().min(1),
  lapStartedAt: sweepTimeSchema,
});
export type SweepAuthScanLap = z.infer<typeof SweepAuthScanLapSchema>;

export const SweepStateSchema = z
  .object({
    fullScanLastRunAt: sweepTimeSchema.optional(),
    fullScanLap: SweepAuthScanLapSchema.optional(),
    rollingCursor: SweepRollingCursorSchema.optional(),
    deferred: z.array(SweepDeferredRowSchema).max(SWEEP_STATE_MAX_DEFERRED).optional(),
    updatedAt: sweepTimeSchema,
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
