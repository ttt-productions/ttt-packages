import {
  advanceRollingCursor,
  lapIntervalPending,
  rollingCursorStart,
  sameCursor,
} from '../rolling-cursor.js';
import type { SweepPosition } from '../sweep-state.js';
import type { SweepRow, SweepSource } from './sweep-sources.js';
import { saveAfterRowFailure } from './sweep-report.js';
import type { SweepReport } from './sweep-report.js';
import type { SweepStateStore } from './sweep-state-store.js';

export interface SweepPageRequest<Name extends string, Item> {
  readonly store: SweepStateStore<Name>;
  readonly name: Name;
  readonly source: SweepSource<Item>;
  readonly pageSize: number;
}

export interface SweepPage<Item> {
  readonly rows: readonly SweepRow<Item>[];
  readonly reachedEnd: boolean;
  save(lastPassed: SweepPosition | undefined, reachedEnd: boolean, now: number): Promise<void>;
}

export async function openSweepPage<Name extends string, Item>(
  request: SweepPageRequest<Name, Item>,
): Promise<SweepPage<Item>> {
  const { store, name, source, pageSize } = request;
  const stored = await store.read(name);
  let rows: readonly SweepRow<Item>[] = [];
  let reachedEnd = true;
  let failure: Error | undefined;
  for await (const page of source.pages(rollingCursorStart(stored?.rollingCursor), pageSize)) {
    rows = page.rows;
    reachedEnd = page.reachedEnd;
    failure = page.failure;
    break;
  }
  return {
    rows,
    reachedEnd,
    async save(lastPassed, lapReachedEnd, now) {
      const rollingCursor = advanceRollingCursor({
        previous: stored?.rollingCursor,
        lastPassed,
        reachedEnd: lapReachedEnd,
        now,
      });
      if (rollingCursor !== undefined && !sameCursor(rollingCursor, stored?.rollingCursor)) {
        await store.update(name, { rollingCursor }, now);
      }
      if (failure) throw failure;
    },
  };
}

export interface SweepWalkLimits {
  readonly pages?: number;
  readonly rowsExamined?: number;
  readonly deletes?: number;
}

export type SweepRowVisit = 'deleted' | 'kept';

export interface SweepWalkRequest<Name extends string, Item, PageContext> {
  readonly store: SweepStateStore<Name>;
  readonly name: Name;
  readonly source: SweepSource<Item>;
  readonly pageSize: number;
  readonly now: number;
  readonly limits: SweepWalkLimits;
  readonly minLapIntervalMs?: number;
  readonly preparePage?: (rows: readonly SweepRow<Item>[]) => Promise<PageContext>;
  readonly visit: (row: SweepRow<Item>, page: PageContext | undefined) => Promise<SweepRowVisit>;
  readonly report: SweepReport;
}

export type SweepWalkEnd = 'end' | 'pageLimit' | 'examinedLimit' | 'deleteLimit';

export interface SweepWalkRun {
  readonly ran: boolean;
  readonly pages: number;
  readonly examined: number;
  readonly deleted: number;
  readonly endedBy: SweepWalkEnd;
  readonly lapComplete: boolean;
}

function assertWalkBounded(limits: SweepWalkLimits): void {
  if (limits.pages === undefined && limits.rowsExamined === undefined)
    throw new RangeError('a sweep walk needs a page or rows-examined limit for one run');
}

export async function walkSweep<Name extends string, Item, PageContext = undefined>(
  request: SweepWalkRequest<Name, Item, PageContext>,
): Promise<SweepWalkRun> {
  const { store, name, source, pageSize, now, limits } = request;
  assertWalkBounded(limits);
  const stored = await store.read(name);
  if (lapIntervalPending(stored?.rollingCursor, now, request.minLapIntervalMs)) {
    return { ran: false, pages: 0, examined: 0, deleted: 0, endedBy: 'end', lapComplete: false };
  }

  let pages = 0;
  let examined = 0;
  let deleted = 0;
  let endedBy: SweepWalkEnd = 'end';
  let lastPassed: SweepPosition | undefined;

  const save = async (reachedEnd: boolean) => {
    const rollingCursor = advanceRollingCursor({
      previous: stored?.rollingCursor,
      lastPassed,
      reachedEnd,
      now,
    });
    if (rollingCursor === undefined || sameCursor(rollingCursor, stored?.rollingCursor)) return;
    await store.update(name, { rollingCursor }, now);
  };

  try {
    walk: for await (const page of source.pages(
      rollingCursorStart(stored?.rollingCursor),
      pageSize,
    )) {
      pages += 1;
      const context = request.preparePage ? await request.preparePage(page.rows) : undefined;
      for (const row of page.rows) {
        if (limits.rowsExamined !== undefined && examined >= limits.rowsExamined) {
          endedBy = 'examinedLimit';
          break walk;
        }
        if (limits.deletes !== undefined && deleted >= limits.deletes) {
          endedBy = 'deleteLimit';
          break walk;
        }
        examined += 1;
        if ((await request.visit(row, context)) === 'deleted') deleted += 1;
        lastPassed = row.position;
      }
      if (page.failure) throw page.failure;
      if (page.reachedEnd) break;
      if (limits.pages !== undefined && pages >= limits.pages) {
        endedBy = 'pageLimit';
        break;
      }
    }
  } catch (error) {
    await saveAfterRowFailure(() => save(false), request.report);
    throw error;
  }

  await save(endedBy === 'end');
  return { ran: true, pages, examined, deleted, endedBy, lapComplete: endedBy === 'end' };
}
