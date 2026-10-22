import { describe, expect, it } from 'vitest';
import type { Finding } from '../../src/guard.js';
import { checkSamples } from '../../src/node/suite/run.js';
import {
  readStateBranchesGuard,
  type ReadStateBranchFacts,
} from '../../src/modules/frontend-reads/read-state-branches.js';
import { runDefinition } from './run.js';

const lines = (...l: string[]) => l.join('\n');
const show = (findings: Finding[]) =>
  findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);

const facts = (
  exceptions: Partial<ReadStateBranchFacts['exceptions']> = {},
): ReadStateBranchFacts => ({
  surfaceTrees: ['src/components'],
  fields: {
    data: ['data'],
    failure: ['error', 'isError'],
    failureCarriers: ['retryState'],
    loading: ['isLoading'],
  },
  exceptions: { failureBranches: [], loadingWithoutFailure: [], ...exceptions },
});

async function run(
  files: Record<string, string>,
  f: ReadStateBranchFacts = facts(),
): Promise<{ branches: string[]; loading: string[] }> {
  const [branches, loading] = await runDefinition(readStateBranchesGuard, f, {
    'src/components/anchor.tsx': 'export const Anchor = () => null;',
    ...files,
  });
  return { branches: show(branches!), loading: show(loading!) };
}

describe('a failure branch that replaces a read also checks that nothing answered', () => {
  it('flags a ternary and a returning if that swap answered content for the failure', async () => {
    const { branches } = await run({
      'src/components/list.tsx': lines(
        'export function List() {',
        '  const { data, error, isLoading } = useRows();',
        '  if (isLoading) return <Spinner />;',
        '  return error ? <Failed /> : <Rows rows={data} />;',
        '}',
      ),
      'src/components/card.tsx': lines(
        'export function Card() {',
        '  const card = useCard();',
        '  if (card.isError) return <Failed />;',
        '  return <Body card={card.data} />;',
        '}',
      ),
      'src/components/held.tsx': lines(
        'export function Held() {',
        '  const read = useThing();',
        '  const retryState = useReadRetryState(read, key);',
        '  if (retryState.error) return <Failed />;',
        '  return <Body thing={read.data} />;',
        '}',
      ),
    });
    expect(branches).toEqual([
      'src/components/card.tsx:3 not on the reviewed list: card.isError branches without checking that card holds no answer',
      'src/components/held.tsx:4 not on the reviewed list: retryState.error branches without checking that read holds no answer',
      'src/components/list.tsx:4 not on the reviewed list: error branches without checking that useRows() holds no answer',
    ]);
  });

  it("passes a branch conjoined with the same read's no-data check, an inline failure beside content, and code outside the surface trees", async () => {
    const { branches } = await run({
      'src/components/list.tsx': lines(
        'export function List() {',
        '  const { data, error, isLoading } = useRows();',
        '  if (isLoading) return <Spinner />;',
        '  if (error && !data) return <Failed />;',
        '  return <>{error && <InlineFailure />}<Rows rows={data} /></>;',
        '}',
      ),
      'src/components/card.tsx': lines(
        'export function Card() {',
        '  const card = useCard();',
        '  return card.isError && card.data === undefined ? <Failed /> : <Body card={card.data} />;',
        '}',
      ),
      'src/components/held.tsx': lines(
        'export function Held() {',
        '  const read = useThing();',
        '  const retryState = useReadRetryState(read, key);',
        '  if (retryState.error && read.data == null) return <Failed />;',
        '  if (!retryState.error) track();',
        '  return <Body thing={read.data} />;',
        '}',
      ),
      'src/lib/outside.tsx': lines(
        'export function Outside() {',
        '  const { data, error } = useRows();',
        '  return error ? <Failed /> : <Rows rows={data} />;',
        '}',
      ),
    });
    expect(branches).toEqual([]);
  });

  it('flags a branch whose no-data check names a different read', async () => {
    const { branches } = await run({
      'src/components/pair.tsx': lines(
        'export function Pair() {',
        '  const a = useA();',
        '  const b = useB();',
        '  return a.error && !b.data ? <Failed /> : <Body a={a.data} b={b.data} />;',
        '}',
      ),
    });
    expect(branches).toEqual([
      'src/components/pair.tsx:4 not on the reviewed list: a.error branches without checking that a holds no answer',
    ]);
  });

  it('flags a no-data check that is not conjoined with the failure, or that is double-negated', async () => {
    const { branches } = await run({
      'src/components/either.tsx': lines(
        'export function Either() {',
        '  const { data, error } = useRows();',
        '  return error || !data ? <Failed /> : <Rows rows={data} />;',
        '}',
      ),
      'src/components/double.tsx': lines(
        'export function Double() {',
        '  const { data, error } = useRows();',
        '  return error && !!data ? <Failed /> : <Rows rows={data} />;',
        '}',
      ),
    });
    expect(branches).toEqual([
      'src/components/double.tsx:3 not on the reviewed list: error branches without checking that useRows() holds no answer',
      'src/components/either.tsx:3 not on the reviewed list: error branches without checking that useRows() holds no answer',
    ]);
  });

  it('keeps two reads that share a name in different components apart', async () => {
    const { branches, loading } = await run({
      'src/components/two.tsx': lines(
        'export function A() {',
        '  const q = useA();',
        '  if (q.isLoading) return <Spinner />;',
        '  return <Body a={q.data} />;',
        '}',
        'export function B() {',
        '  const q = useB();',
        '  if (q.error) return <Failed />;',
        '  return <Body b={q.data} />;',
        '}',
        'export function C() {',
        '  const q = useC();',
        '  if (q.error && !q.data) return <Failed />;',
        '  return <Body c={q.data} />;',
        '}',
      ),
    });
    expect(loading).toEqual([
      "src/components/two.tsx:3 not on the reviewed list: q.isLoading is used, but q's failure never is",
    ]);
    expect(branches).toEqual([
      'src/components/two.tsx:8 not on the reviewed list: q.error branches without checking that q holds no answer',
    ]);
  });

  it('passes a reviewed branch and flags it once the branch is gone', async () => {
    const reviewed = facts({
      failureBranches: [
        {
          path: 'src/components/list.tsx',
          why: 'the failure replaces a read that never holds data',
        },
      ],
    });
    const bad = lines(
      'export function List() {',
      '  const { data, error } = useRows();',
      '  return error ? <Failed /> : <Rows rows={data} />;',
      '}',
    );
    expect((await run({ 'src/components/list.tsx': bad }, reviewed)).branches).toEqual([]);
    expect(
      (await run({ 'src/components/list.tsx': 'export const List = () => null;' }, reviewed))
        .branches,
    ).toEqual([
      'src/components/list.tsx stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
    ]);
  });
});

describe("a surface that renders a read's loading state also renders its failure", () => {
  it('flags a loading branch with no failure read, per read', async () => {
    const { loading } = await run({
      'src/components/list.tsx': lines(
        'export function List() {',
        '  const { data, isLoading } = useRows();',
        '  const tags = useTags();',
        '  const { error } = useOther();',
        '  if (isLoading || tags.isLoading) return <Spinner />;',
        '  return <Rows rows={data} tags={tags.data} />;',
        '}',
      ),
    });
    expect(loading).toEqual([
      "src/components/list.tsx:5 not on the reviewed list: isLoading is used, but useRows()'s failure never is",
      "src/components/list.tsx:5 not on the reviewed list: tags.isLoading is used, but tags's failure never is",
    ]);
  });

  it("passes a loading state paired with its own read's failure or its failure carrier", async () => {
    const { loading } = await run({
      'src/components/list.tsx': lines(
        'export function List() {',
        '  const { data, isLoading, isError } = useRows();',
        '  const tags = useTags();',
        '  const { isLoading: pending, retryState } = useMore();',
        '  if (isLoading || tags.isLoading || pending) return <Spinner />;',
        '  if (isError && !data) return <Failed />;',
        '  return <Rows rows={data} tags={tags.data} failure={tags.retryState} more={retryState} />;',
        '}',
      ),
    });
    expect(loading).toEqual([]);
  });

  it('passes a reviewed surface and flags it once it reads the failure', async () => {
    const reviewed = facts({
      loadingWithoutFailure: [{ path: 'src/components/list.tsx', why: 'a skeleton only' }],
    });
    const bad = lines(
      'export function List() {',
      '  const { isLoading } = useRows();',
      '  return isLoading ? <Spinner /> : null;',
      '}',
    );
    expect((await run({ 'src/components/list.tsx': bad }, reviewed)).loading).toEqual([]);
    const fixed = lines(
      'export function List() {',
      '  const { isLoading, error } = useRows();',
      '  return isLoading ? <Spinner /> : error ? <Failed /> : null;',
      '}',
    );
    expect((await run({ 'src/components/list.tsx': fixed }, reviewed)).loading).toEqual([
      'src/components/list.tsx stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
    ]);
  });
});

describe('the read-state branch facts', () => {
  it('prove their matchers', () => {
    for (const guard of readStateBranchesGuard.build(facts())) checkSamples(guard);
  });

  it('flag a surface tree with no code', async () => {
    const f = { ...facts(), surfaceTrees: ['src/components', 'src/gone'] };
    const { branches, loading } = await run({}, f);
    expect(branches).toEqual([
      'src/gone the tree holds no production code the guard can read (moved, or not under the app root)',
    ]);
    expect(loading).toEqual(branches);
  });

  it('refuse a field named in two roles and a missing field list', () => {
    expect(
      readStateBranchesGuard.factProblems({
        ...facts(),
        fields: { data: ['data'], failure: ['data'], failureCarriers: [], loading: [] },
      }),
    ).toEqual(['fields.loading is empty', 'fields names data in two roles']);
  });
});
