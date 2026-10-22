// Its own module: the sweep-state doc and the child-safety case both embed it, and the sweep-state
// module imports the case module.

import { z } from 'zod';

// Resume with startAfter(afterValue, afterKey), never `field > afterValue`: rows can share a value.
// A Storage listing's page token is opaque, so a listing stores the object name.
export const SweepRollingCursorSchema = z
  .discriminatedUnion('state', [
    z
      .object({
        state: z.literal('inLap'),
        afterKey: z.string().min(1),
        afterValue: z.number().optional(),
        lapStartedAt: z.number().int().nonnegative(),
      })
      .strict(),
    z
      .object({
        state: z.literal('done'),
        lapStartedAt: z.number().int().nonnegative(),
        lapCompletedAt: z.number().int().nonnegative(),
      })
      .strict(),
  ])
  .superRefine((val, ctx) => {
    if (val.state === 'done' && val.lapCompletedAt < val.lapStartedAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['lapCompletedAt'],
        message: 'a lap completes no earlier than it started',
      });
    }
  });
export type SweepRollingCursor = z.infer<typeof SweepRollingCursorSchema>;
