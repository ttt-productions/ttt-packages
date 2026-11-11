import { SweepRollingCursorSchema } from './sweep-state.js';
import type { SweepPosition, SweepRollingCursor } from './sweep-state.js';

export function rollingCursorStart(cursor: SweepRollingCursor | undefined): SweepPosition | null {
  if (cursor?.state !== 'inLap') return null;
  return cursor.afterValue === undefined
    ? { key: cursor.afterKey }
    : { key: cursor.afterKey, value: cursor.afterValue };
}

export function advanceRollingCursor(args: {
  readonly previous: SweepRollingCursor | undefined;
  readonly lastPassed: SweepPosition | undefined;
  readonly reachedEnd: boolean;
  readonly now: number;
}): SweepRollingCursor | undefined {
  const lapStartedAt = args.previous?.state === 'inLap' ? args.previous.lapStartedAt : args.now;
  if (args.reachedEnd) {
    return SweepRollingCursorSchema.parse({
      state: 'done',
      lapStartedAt,
      lapCompletedAt: args.now,
    });
  }
  if (!args.lastPassed) return args.previous;
  return SweepRollingCursorSchema.parse({
    state: 'inLap',
    afterKey: args.lastPassed.key,
    ...(args.lastPassed.value !== undefined ? { afterValue: args.lastPassed.value } : {}),
    lapStartedAt,
  });
}

export function sameCursor(
  a: SweepRollingCursor | undefined,
  b: SweepRollingCursor | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.state === 'done' || b.state === 'done') {
    return (
      a.state === b.state &&
      a.lapStartedAt === b.lapStartedAt &&
      (a.state !== 'done' || b.state !== 'done' || a.lapCompletedAt === b.lapCompletedAt)
    );
  }
  return (
    a.afterKey === b.afterKey && a.afterValue === b.afterValue && a.lapStartedAt === b.lapStartedAt
  );
}

export function lapIntervalPending(
  cursor: SweepRollingCursor | undefined,
  now: number,
  minLapIntervalMs: number | undefined,
): boolean {
  return (
    minLapIntervalMs !== undefined &&
    cursor?.state === 'done' &&
    now - cursor.lapCompletedAt < minLapIntervalMs
  );
}
