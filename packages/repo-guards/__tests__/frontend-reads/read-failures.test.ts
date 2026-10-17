// The read-failure guards: a read's failure renders through the one read-state module, from a retry
// state held through its retry, out of hooks and surfaces that never pass a failed read off as
// data, with copy from the one copy owner.

import { describe, expect, it } from 'vitest';
import {
  defaultedReadBindingGuard,
  hookReadDefaultGuard,
  laterPageFailureGuard,
  readFailureCopyGuard,
  readRetryStateGuard,
  readStateOwnerGuard,
  type DefaultedReadBindingFacts,
  type LaterPageFailureFacts,
  type ReadFailureCopyFacts,
} from '../../src/modules/frontend-reads/read-failures.js';
import { checkSamples } from '../../src/suite/run.js';
import { runOne } from './run.js';

const MODULE = 'src/components/shared/read-state.tsx';

describe('read failures render only through the read-state module', () => {
  const facts = { module: MODULE, seatComponent: 'Seat', laterPageRetry: 'laterRetry' };
  const moduleSource = 'export function laterRetry(list) { return list; }\nexport const ReadState = () => <Seat thing="x" />;';

  it('passes when only the module renders the seat or routes a later page', async () => {
    const findings = await runOne(readStateOwnerGuard, facts, {
      [MODULE]: moduleSource,
      'src/components/rows.tsx': 'return <ReadState read={rows} thing="rows" />;\n// <Seat /> named in prose only',
      'src/components/seat.tsx': 'export function Seat() { return null; }',
    });
    expect(findings).toEqual([]);
  });

  it('flags a surface rendering the seat and one routing a later page itself', async () => {
    const findings = await runOne(readStateOwnerGuard, facts, {
      [MODULE]: moduleSource,
      'src/components/a.tsx': 'return <Seat thing="rows" />;',
      'src/components/b.tsx': 'const x = 1;\nconst retry = laterRetry(list);',
    });
    expect(findings).toEqual([
      { file: 'src/components/a.tsx', line: 1, detail: 'outside its owner: <Seat' },
      { file: 'src/components/b.tsx', line: 2, detail: 'outside its owner: laterRetry(' },
    ]);
  });

  it('flags a module that no longer renders the seat, and one that is gone', async () => {
    expect(await runOne(readStateOwnerGuard, facts, { [MODULE]: 'export const x = 1;' })).toEqual([
      { file: MODULE, detail: 'stale owner: the pattern no longer appears in it (or it is outside the scope)' },
    ]);
    expect(await runOne(readStateOwnerGuard, facts, {})).toEqual([{ file: MODULE, detail: 'the owner file no longer exists' }]);
  });

  it('proves its samples', () => {
    for (const guard of readStateOwnerGuard.build(facts)) expect(() => checkSamples(guard)).not.toThrow();
  });

  it('refuses facts with no module or a name that is not an identifier', () => {
    expect(readStateOwnerGuard.factProblems({ module: '', seatComponent: 'Seat', laterPageRetry: 'a-b' })).toEqual([
      'module is missing',
      'laterPageRetry must be an identifier',
    ]);
  });
});

describe("a read's retry state comes from its one owner, never the live fetching flags", () => {
  const facts = { seat: { component: 'Seat', retryProp: 'onRetry', pendingProp: 'retrying' } };

  it('passes the held retry state, a load-more pending, a spread, and prose', async () => {
    const findings = await runOne(readRetryStateGuard, facts, {
      'src/hooks/use-rows.ts': [
        'const retryState = useReadRetryState(query, key);',
        'return { rows, retryState, isRetrying: retryState.isRetrying };',
        'const held = useReadRetryState({ error, isFetching: running, isLoading }, ids);',
        'return { isRetrying: held.isRetrying };',
        'return { onRetry: () => void list.fetchNextPage(), retrying: list.isFetchingNextPage };',
        'interface Result { isRetrying: boolean; retrying?: boolean }',
        '// isRetrying: query.isFetching && error !== null',
      ].join('\n'),
      'src/components/rows.tsx': [
        '<Seat thing="rows" onRetry={retry} retrying={read.retryState.isRetrying} />',
        '<Seat thing="pages" {...laterRetry(list)} />',
        '<Seat thing="search" />',
        '<Pager busy={reports.isFetching} />',
      ].join('\n'),
    });
    expect(findings).toEqual([]);
  });

  it('flags every shape a retry state built from the live flags takes', async () => {
    const findings = await runOne(readRetryStateGuard, facts, {
      'src/a.ts': 'const busy = isError && query.isFetching;',
      'src/b.ts': 'const busy = q.isFetching && q.error;',
      'src/c.tsx': '<Seat thing="x" onRetry={retry} retrying={isRefetching} />',
      'src/d.ts': 'return { isRetrying: query.fetchStatus === "fetching" };',
      'src/e.ts': 'const busy = query.isFetching;\nreturn { isRetrying: busy };',
      'src/f.ts': 'return { retrying: live.sourceState === "connecting" };',
      'src/g.ts': 'return { isRetrying: lookupError !== null && fetchingCount > 0 };',
      'src/h.ts': 'return {\n  retrying: results.some(\n    (r) => r.error !== null && r.isFetching,\n  ),\n};',
    });
    expect(findings).toEqual([
      { file: 'src/a.ts', line: 1, detail: 'failure flag && isFetching: const busy = isError && query.isFetching;' },
      { file: 'src/b.ts', line: 1, detail: 'isFetching && failure flag: const busy = q.isFetching && q.error;' },
      { file: 'src/c.tsx', line: 1, detail: 'retry state from a fetching flag: isRefetching' },
      { file: 'src/d.ts', line: 1, detail: 'retry state from a fetching flag: query.fetchStatus === "fetching"' },
      { file: 'src/e.ts', line: 2, detail: 'retry state from a fetching flag: busy' },
      { file: 'src/f.ts', line: 1, detail: 'retry state from a fetching flag: live.sourceState === "connecting"' },
      { file: 'src/g.ts', line: 1, detail: 'retry state from a fetching flag: lookupError !== null && fetchingCount > 0' },
      { file: 'src/h.ts', line: 2, detail: 'retry state from a fetching flag: results.some( (r) => r.error !== null && r.isFetching, )' },
    ]);
  });

  it('flags a seat given a retry with nothing to show it running', async () => {
    const findings = await runOne(readRetryStateGuard, facts, { 'src/a.tsx': 'const x = 1;\n<Seat thing="names" onRetry={retry} />' });
    expect(findings).toEqual([{ file: 'src/a.tsx', line: 2, detail: '<Seat onRetry=…> without retrying' }]);
  });

  it('refuses a seat with a missing prop name', () => {
    expect(readRetryStateGuard.factProblems({ seat: { component: 'Seat', retryProp: 'onRetry' } as never })).toEqual([
      'seat.pendingProp must be an identifier',
    ]);
    expect(readRetryStateGuard.factProblems({} as never)).toEqual(['seat is missing']);
  });
});

describe('a hook never returns a default its consumers cannot tell from data', () => {
  const facts = { hooksTree: 'src/hooks', readCollapsers: ['allows'] };

  it('passes a default whose failure travels with it, and leaves code outside the hooks tree to the surface guard', async () => {
    const findings = await runOne(hookReadDefaultGuard, facts, {
      'src/hooks/use-a.ts': [
        'export function useA() { const q = useQ(); return { rows: q.data ?? [], error: q.error }; }',
        'export function useB() { const { data = [], isError } = useQ(); return { data, isError }; }',
        'export function useC() { const q = useQ(); const s = useReadRetryState(q, k); return { rows: q.data ?? [], error: s.error }; }',
        'export function useD(): boolean { return useIsMutating() > 0; }',
        'export function useE(id: string) { const q = useQ(id); return { row: q.data, isError: q.isError }; }',
      ].join('\n'),
      'src/components/rows.tsx': 'export function useRows() { const q = useQ(); return q.data ?? []; }',
    });
    expect(findings).toEqual([]);
  });

  it('flags a default with no failure beside it and a read collapsed to a boolean, annotated or not', async () => {
    const findings = await runOne(hookReadDefaultGuard, facts, {
      'src/hooks/use-a.ts': 'export function useRows() { const q = useQ(); return q.data ?? []; }',
      'src/hooks/use-b.ts': 'export function useRows() { const { data = [] } = useQ(); return data; }',
      'src/hooks/use-c.ts': 'export function useCan(id: string): boolean { return allows(usePermission(id)); }',
      'src/hooks/use-d.ts': 'export const useHasRows = (id: string) => (useRows(id).data?.length ?? 0) > 0;',
      'src/hooks/use-e.ts': 'export function useLiked(id: string) { const q = useLike(id); return !!q.data; }',
      'src/hooks/use-f.ts': 'export function useRows() { const q = useQ(); const o = useO(); const s = useReadRetryState(o, k); return { rows: q.data ?? [], error: s.error }; }',
    });
    expect(findings).toEqual([
      { file: 'src/hooks/use-a.ts', line: 1, detail: 'a defaulted read with no failure beside it: q.data ?? []' },
      { file: 'src/hooks/use-b.ts', line: 1, detail: 'a defaulted read with no failure beside it: { data = [] }' },
      { file: 'src/hooks/use-c.ts', line: 1, detail: 'useCan returns a boolean from a read' },
      { file: 'src/hooks/use-d.ts', line: 1, detail: 'useHasRows returns a boolean from a read' },
      { file: 'src/hooks/use-e.ts', line: 1, detail: 'useLiked returns a boolean from a read' },
      { file: 'src/hooks/use-f.ts', line: 1, detail: 'a defaulted read with no failure beside it: q.data ?? []' },
    ]);
  });

  it('flags a hooks tree it cannot reach', async () => {
    expect(await runOne(hookReadDefaultGuard, facts, { 'src/lib/x.ts': 'export {};' })).toEqual([
      { file: 'src/hooks', detail: 'the tree holds no production code the guard can read (moved, or not under the app root)' },
    ]);
  });

  it('refuses facts with no hooks tree, an absolute tree, or no collapser list', () => {
    expect(hookReadDefaultGuard.factProblems({ hooksTree: '/src/hooks', readCollapsers: undefined as never })).toEqual([
      'hooksTree (/src/hooks) must be repo-relative and forward-slashed',
      'readCollapsers is missing (an app with none declares [])',
    ]);
  });
});

describe('a render surface that defaults a read binds its failure', () => {
  const facts: DefaultedReadBindingFacts = {
    surfaceTrees: ['src/components'],
    heldFailureFields: ['held'],
    allowlist: [{ path: 'src/components/known.tsx', why: 'renders only after the same read has answered' }],
  };

  it('passes a bound, held, spread, undefaulted, non-hook, or reviewed default, and a default outside the surfaces', async () => {
    const findings = await runOne(defaultedReadBindingGuard, facts, {
      'src/components/rows.tsx': [
        'const { data: a = [], isError } = useRows();',
        'const { data: b = [], held } = useRows();',
        'const { data: c = [], ...rest } = useRows();',
        'const { data: d } = useRows();',
        'const { data: e = [] } = buildRows();',
      ].join('\n'),
      'src/components/known.tsx': 'const { data: rows = [] } = useRows(id);',
      'src/hooks/use-rows.ts': 'const { data: rows = [] } = useRows(id);',
    });
    expect(findings).toEqual([]);
  });

  it('flags a default with no failure bound', async () => {
    const findings = await runOne(defaultedReadBindingGuard, facts, {
      'src/components/known.tsx': 'const { data: rows = [] } = useRows(id);',
      'src/components/a.tsx': 'const { data: rows = [] } = useRows(id);',
      'src/components/b.tsx': 'const x = 1;\nconst { data: row = null, isLoading } = useRow(id);',
    });
    expect(findings).toEqual([
      { file: 'src/components/a.tsx', line: 1, detail: 'not on the reviewed list: useRows() defaults data with no failure bound' },
      { file: 'src/components/b.tsx', line: 2, detail: 'not on the reviewed list: useRow() defaults data with no failure bound' },
    ]);
  });

  it('flags a reviewed file that no longer defaults a read', async () => {
    expect(await runOne(defaultedReadBindingGuard, facts, { 'src/components/known.tsx': 'export {};' })).toEqual([
      { file: 'src/components/known.tsx', detail: 'stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)' },
    ]);
  });

  it('proves its samples', () => {
    for (const guard of defaultedReadBindingGuard.build(facts)) expect(() => checkSamples(guard)).not.toThrow();
  });

  it('refuses facts with no surface tree or an entry with no why', () => {
    expect(defaultedReadBindingGuard.factProblems({ surfaceTrees: [], heldFailureFields: [], allowlist: [{ path: 'src/a.tsx', why: ' ' }] })).toEqual([
      'surfaceTrees names no path',
      'allowlist entry src/a.tsx carries no why',
    ]);
  });
});

describe("an infinite list's later-page failure routes through the read-state module", () => {
  const facts: LaterPageFailureFacts = {
    hooksTree: 'src/hooks',
    readStateModule: MODULE,
    listRoutes: [{ component: 'ReadState', prop: 'list' }, { component: 'ListFailure' }],
    handOffProp: 'list',
  };
  const base = {
    [MODULE]: 'export function ReadState() { return null; }',
    'src/components/table.tsx': 'export function RowsTable({ list }) { return <ReadState list={list} thing="rows">{r}</ReadState>; }',
    'src/components/loose.tsx': 'export function LooseTable({ list }) { return <Seat thing="rows" onRetry={list.refetch} />; }',
    'src/hooks/use-list.ts': 'const more = list.fetchNextPage;',
  };

  it('passes a list rendered through the module, handed to a component that does, or paged in a hook', async () => {
    const findings = await runOne(laterPageFailureGuard, facts, {
      ...base,
      'src/components/a.tsx': 'const more = hasNextPage;\nreturn <ReadState\n  list={rows}\n  thing="rows">{r}</ReadState>;',
      'src/components/b.tsx': 'const more = hasNextPage;\nreturn <ListFailure list={rows} thing="rows" />;',
      'src/components/c.tsx': 'const more = hasNextPage;\nreturn <RowsTable list={rows} />;',
    });
    expect(findings).toEqual([]);
  });

  it('flags a paging surface with its own retry, a plain read route, an unrouted hand-off, and a route named only in prose', async () => {
    const findings = await runOne(laterPageFailureGuard, facts, {
      ...base,
      'src/components/own.tsx': '<Button onClick={list.fetchNextPage}>More</Button>',
      'src/components/read.tsx': 'const more = hasNextPage;\nreturn <ReadState read={rows} thing="rows">{r}</ReadState>;',
      'src/components/loose-user.tsx': 'const more = hasNextPage;\nreturn <LooseTable list={rows} />;',
      'src/components/prose.tsx': '// <ListFailure list={rows} />\nconst more = hasNextPage;',
    });
    const detail = 'pages an infinite list without routing its later-page failure through the read-state module';
    expect(findings).toEqual([
      { file: 'src/components/loose-user.tsx', detail },
      { file: 'src/components/own.tsx', detail },
      { file: 'src/components/prose.tsx', detail },
      { file: 'src/components/read.tsx', detail },
    ]);
  });

  it('flags a read-state module that is gone', async () => {
    expect(await runOne(laterPageFailureGuard, facts, { 'src/components/a.tsx': 'export {};' })).toEqual([
      { file: MODULE, detail: 'the read-state module no longer exists' },
    ]);
  });

  it('refuses facts with no list route', () => {
    expect(laterPageFailureGuard.factProblems({ ...facts, listRoutes: [] })).toEqual(['listRoutes names no component']);
  });
});

describe("a read failure's copy comes from its one owner", () => {
  const OWNER = 'src/components/shared/load-error-state.tsx';
  const facts: ReadFailureCopyFacts = {
    owner: OWNER,
    allowlist: [{ path: 'src/server/route.ts', why: 'a monitoring message, never shown to a person' }],
  };
  const base = {
    [OWNER]: 'const sentence = `Could not load ${thing}.`;',
    'src/server/route.ts': "captureMessage('Config failed to load');",
  };

  it('passes the owner, a reviewed file, and copy that is not a read failure', async () => {
    const findings = await runOne(readFailureCopyGuard, facts, {
      ...base,
      'src/components/a.tsx': 'hint="a list that could not be read is not an empty list."\n<LoadingState label="Loading rows" />\n// Could not load rows (prose)',
    });
    expect(findings).toEqual([]);
  });

  it('flags a hand-written read-failure sentence in any casing and around any read verb', async () => {
    const findings = await runOne(readFailureCopyGuard, facts, {
      ...base,
      'src/components/a.tsx': '<p>Could not load commissions.</p>',
      'src/components/b.tsx': '<AlertTitle>Error Loading Audition</AlertTitle>',
      'src/components/c.tsx': '"Couldn\'t fetch the roster."',
      'src/components/d.tsx': 'error={e ? "Could not search users." : null}',
      'src/components/e.tsx': 'Standings failed to load',
    });
    expect(findings).toEqual([
      { file: 'src/components/a.tsx', line: 1, detail: 'not on the reviewed list: Could not load' },
      { file: 'src/components/b.tsx', line: 1, detail: 'not on the reviewed list: Error Loading' },
      { file: 'src/components/c.tsx', line: 1, detail: "not on the reviewed list: Couldn't fetch" },
      { file: 'src/components/d.tsx', line: 1, detail: 'not on the reviewed list: Could not search' },
      { file: 'src/components/e.tsx', line: 1, detail: 'not on the reviewed list: failed to load' },
    ]);
  });

  it('flags an owner that no longer builds the sentence, and a reviewed file that no longer holds one', async () => {
    const findings = await runOne(readFailureCopyGuard, facts, { [OWNER]: 'export {};', 'src/server/route.ts': 'export {};' });
    const stale = 'stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)';
    expect(findings).toEqual([
      { file: OWNER, detail: stale },
      { file: 'src/server/route.ts', detail: stale },
    ]);
  });

  it('proves its samples', () => {
    for (const guard of readFailureCopyGuard.build(facts)) expect(() => checkSamples(guard)).not.toThrow();
  });

  it('refuses the owner listed as an exception, and an exception with no why', () => {
    expect(readFailureCopyGuard.factProblems({ owner: OWNER, allowlist: [{ path: OWNER, why: 'x' }, { path: 'src/a.ts', why: '' }] })).toEqual([
      'allowlist entry src/a.ts carries no why',
      'the owner is listed in the allowlist',
    ]);
  });
});
