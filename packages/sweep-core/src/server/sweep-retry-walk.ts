import { advanceRollingCursor, rollingCursorStart, sameCursor } from '../rolling-cursor.js';
import { SWEEP_STATE_MAX_DEFERRED } from '../sweep-state.js';
import type { SweepDeferredRow, SweepPosition } from '../sweep-state.js';
import type { SweepRow, SweepSource } from './sweep-sources.js';
import { saveAfterRowFailure } from './sweep-report.js';
import type { SweepReport } from './sweep-report.js';
import type { SweepStateStore } from './sweep-state-store.js';

export type SweepRowOutcome = 'cleared' | 'tryLater' | 'outOfBudget';

export type SweepRetryTiming =
  | { readonly kind: 'nextRun' }
  | {
      readonly kind: 'growingWait';
      readonly nextAttemptAt: (now: number, attemptCount: number) => number;
    };

export interface SweepRetryListFull {
  readonly key: string;
  readonly retryRows: number;
}

export interface SweepRetryWalkRequest<Name extends string, Item> {
  readonly store: SweepStateStore<Name>;
  readonly name: Name;
  readonly source: SweepSource<Item>;
  readonly pageSize: number;
  readonly pages: number;
  readonly now: number;
  readonly retry: SweepRetryTiming;
  readonly reread: (rows: readonly SweepDeferredRow[]) => Promise<ReadonlyMap<string, Item>>;
  readonly examine: (row: SweepRow<Item>) => Promise<SweepRowOutcome>;
  readonly onRetryListFull: (event: SweepRetryListFull) => void;
  readonly report: SweepReport;
}

export interface SweepRetryWalkRun {
  readonly examined: number;
  readonly cleared: number;
  readonly triedLater: readonly string[];
  readonly outOfBudget: number;
  readonly retryRows: number;
  readonly positionHeld: boolean;
  readonly retryListFull: boolean;
  readonly lapComplete: boolean;
}

function nextAttemptAt(retry: SweepRetryTiming, now: number, attemptCount: number): number {
  return retry.kind === 'nextRun' ? now : retry.nextAttemptAt(now, attemptCount);
}

function positionOf(row: SweepDeferredRow): SweepPosition {
  return row.value === undefined ? { key: row.key } : { key: row.key, value: row.value };
}

export async function walkSweepWithRetryList<Name extends string, Item>(
  request: SweepRetryWalkRequest<Name, Item>,
): Promise<SweepRetryWalkRun> {
  const { store, name, source, pageSize, now, retry } = request;
  if (!(request.pages >= 1)) throw new RangeError('a sweep walk reads at least one page a run');
  const stored = await store.read(name);
  const listed = new Map<string, SweepDeferredRow>(
    (stored?.deferred ?? []).map((row) => [row.key, row]),
  );
  let listChanged = false;
  let examined = 0;
  let cleared = 0;
  let outOfBudget = 0;
  const triedLater: string[] = [];
  let positionHeld = false;
  let retryListFull = false;
  let lastPassed: SweepPosition | undefined;
  let reachedEnd = false;

  const save = async (lapReachedEnd: boolean) => {
    const rollingCursor = advanceRollingCursor({
      previous: stored?.rollingCursor,
      lastPassed,
      reachedEnd: lapReachedEnd,
      now,
    });
    const cursorChanged =
      rollingCursor !== undefined && !sameCursor(rollingCursor, stored?.rollingCursor);
    if (!listChanged && !cursorChanged) return;
    await store.update(
      name,
      {
        ...(cursorChanged ? { rollingCursor } : {}),
        ...(listChanged ? { deferred: [...listed.values()] } : {}),
      },
      now,
    );
  };

  try {
    const due = [...listed.values()].filter((row) => row.nextAttemptAt <= now);
    if (due.length > 0) {
      const current = await request.reread(due);
      for (const row of due) {
        listChanged = true;
        const item = current.get(row.key);
        if (item === undefined) {
          listed.delete(row.key);
          cleared += 1;
          continue;
        }
        examined += 1;
        const outcome = await request.examine({ key: row.key, position: positionOf(row), item });
        if (outcome === 'cleared') {
          listed.delete(row.key);
          cleared += 1;
        } else if (outcome === 'outOfBudget') {
          listed.set(row.key, { ...row, nextAttemptAt: now });
          outOfBudget += 1;
        } else {
          const attemptCount = row.attemptCount + 1;
          listed.set(row.key, {
            ...row,
            nextAttemptAt: nextAttemptAt(retry, now, attemptCount),
            attemptCount,
          });
          triedLater.push(row.key);
        }
      }
    }

    let pages = 0;
    for await (const page of source.pages(rollingCursorStart(stored?.rollingCursor), pageSize)) {
      pages += 1;
      for (const row of page.rows) {
        if (!listed.has(row.key)) {
          examined += 1;
          const outcome = await request.examine(row);
          if (outcome === 'cleared') {
            cleared += 1;
          } else if (outcome === 'outOfBudget') {
            outOfBudget += 1;
            positionHeld = true;
          } else if (listed.size >= SWEEP_STATE_MAX_DEFERRED) {
            positionHeld = true;
            if (!retryListFull) {
              retryListFull = true;
              request.onRetryListFull({ key: row.key, retryRows: listed.size });
            }
          } else {
            listed.set(row.key, {
              key: row.key,
              ...(row.position.value !== undefined ? { value: row.position.value } : {}),
              nextAttemptAt: nextAttemptAt(retry, now, 1),
              attemptCount: 1,
            });
            listChanged = true;
            triedLater.push(row.key);
          }
        }
        if (!positionHeld) lastPassed = row.position;
      }
      if (page.failure) throw page.failure;
      if (page.reachedEnd) {
        reachedEnd = true;
        break;
      }
      if (pages >= request.pages) break;
    }
  } catch (error) {
    await saveAfterRowFailure(() => save(false), request.report);
    throw error;
  }

  const lapComplete = reachedEnd && !positionHeld;
  await save(lapComplete);
  return {
    examined,
    cleared,
    triedLater,
    outOfBudget,
    retryRows: listed.size,
    positionHeld,
    retryListFull,
    lapComplete,
  };
}
