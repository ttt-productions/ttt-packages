// The rolling cursor: where a pass over a bounded, ordered source stands. It is declared in its own
// module because two schemas embed it — the sweep-state doc and the child-safety case's crossover
// legs — and the sweep-state module already imports the case module, so a cursor declared in
// either would make the other import a cycle.

import { z } from 'zod';

// The rolling cursor one scheduled pass keeps over a bounded, ordered source (a Storage listing or
// a Firestore query), so each run resumes where the last stopped instead of rereading the first
// page and starving everything behind a stuck head.
//   absent  — no lap has run: the next pass starts one at the beginning.
//   inLap   — the next page starts strictly after the last row the lap moved past. `afterKey` is
//             that row's key: the object NAME for a Storage listing (a listing's page token is
//             opaque, so it is never stored), the document id for a Firestore query, or the full
//             document path for a collection-group query. `afterValue` is that row's value of the
//             numeric field the query orders by first (e.g. `createdAt`); a source ordered by key
//             alone has none. A value is never a position by itself: rows can share it, so the query
//             orders by the field and then by the key, and resumes with startAfter(afterValue,
//             afterKey) — never `field > afterValue`, which skips every row tied with the last one,
//             on every lap.
//   done    — the last lap reached the end of its source. The pass that exhausted the source
//             records it here instead of starting page one again in the same run; the next pass
//             wraps and starts a new lap from the beginning, so rows added behind the cursor, or
//             rows that became eligible after it passed them, are reached on the next lap.
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
