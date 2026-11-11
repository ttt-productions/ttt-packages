import { describe, expect, it } from 'vitest';
import type { Finding } from '../../src/guard.js';
import { checkSamples } from '../../src/node/suite/run.js';
import {
  readsOnlyWhenShownGuard,
  type ReadsOnlyWhenShownFacts,
} from '../../src/modules/frontend-reads/reads-only-when-shown.js';
import { runDefinition } from './run.js';

const lines = (...l: string[]) => l.join('\n');
const show = (findings: Finding[]) =>
  findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);

const facts = (
  readsAhead: ReadsOnlyWhenShownFacts['readsAhead'] = [],
): ReadsOnlyWhenShownFacts => ({
  readsAhead,
});

async function run(files: Record<string, string>, f: ReadsOnlyWhenShownFacts = facts()) {
  const [readsAhead, keptMounted] = await runDefinition(readsOnlyWhenShownGuard, f, files);
  return { readsAhead: show(readsAhead!), keptMounted: show(keptMounted!) };
}

const HOVER_PREFETCH = lines(
  'export function Row({ id }: Props) {',
  '  const queryClient = useQueryClient();',
  '  return (',
  '    <li onMouseEnter={() => queryClient.prefetchQuery({ queryKey: itemKeys.detail(id), queryFn })}>',
  '      {id}',
  '    </li>',
  '  );',
  '}',
);

describe('nothing reads ahead of the person outside a reviewed entry', () => {
  it('flags a hover prefetch, an ensured read, an infinite prefetch, and a prefetch hook', async () => {
    const { readsAhead } = await run({
      'src/components/row.tsx': HOVER_PREFETCH,
      'src/components/tabs.tsx': lines(
        'export async function warm(client: QueryClient) {',
        '  await client.ensureQueryData({ queryKey: k.tab(), queryFn });',
        '  await client.prefetchInfiniteQuery({ queryKey: k.feed(), queryFn, initialPageParam: null });',
        '  await client.ensureInfiniteQueryData({ queryKey: k.more(), queryFn, initialPageParam: null });',
        '}',
      ),
      'src/components/menu.tsx': lines(
        'export function Menu() {',
        '  usePrefetchQuery(menuOptions);',
        '  usePrefetchInfiniteQuery(listOptions);',
        '  return <nav />;',
        '}',
      ),
    });
    expect(readsAhead).toEqual([
      'src/components/menu.tsx:2 reads ahead of the person: usePrefetchQuery(menuOptions)',
      'src/components/menu.tsx:3 reads ahead of the person: usePrefetchInfiniteQuery(listOptions)',
      'src/components/row.tsx:4 reads ahead of the person: prefetchQuery({ queryKey: itemKeys.detail(id), queryFn })',
      'src/components/tabs.tsx:2 reads ahead of the person: ensureQueryData({ queryKey: k.tab(), queryFn })',
      'src/components/tabs.tsx:3 reads ahead of the person: prefetchInfiniteQuery({ queryKey: k.feed(), queryFn, initialPageParam: null })',
      'src/components/tabs.tsx:4 reads ahead of the person: ensureInfiniteQueryData({ queryKey: k.more(), queryFn, initialPageParam: null })',
    ]);
  });

  it('passes fetchQuery on a click, a query read when shown, a definition named like a prefetch, and test code', async () => {
    const { readsAhead } = await run({
      'src/components/open.tsx': lines(
        'export function Open() {',
        '  const client = useQueryClient();',
        '  const onClick = async () => client.fetchQuery({ queryKey: k.detail(id), queryFn });',
        '  return <button type="button" onClick={onClick}>Open</button>;',
        '}',
      ),
      'src/hooks/use-detail.ts':
        'export const useDetail = (id: string) => useQuery({ queryKey: k.detail(id), queryFn });',
      'src/lib/cache.ts': 'export function prefetchQuery() { return null; }',
      'src/components/row.test.tsx': HOVER_PREFETCH,
    });
    expect(readsAhead).toEqual([]);
  });

  it('passes a reviewed read ahead and flags a reviewed entry that no longer matches', async () => {
    const { readsAhead } = await run(
      { 'src/components/row.tsx': HOVER_PREFETCH },
      facts([
        {
          path: 'src/components/row.tsx',
          call: 'prefetchQuery({ queryKey: itemKeys.detail(id), queryFn })',
          why: 'the next screen is the only place a row leads, and it opens on most visits',
        },
        {
          path: 'src/components/gone.tsx',
          call: 'prefetchQuery(options)',
          why: 'a prefetch since removed',
        },
      ]),
    );
    expect(readsAhead).toEqual([
      'src/components/gone.tsx stale reviewed read ahead: prefetchQuery(options) is no longer there',
    ]);
  });
});

describe('content that is not shown is never kept mounted', () => {
  it('flags forceMount on tab and dialog content, and in a props object', async () => {
    const { keptMounted } = await run({
      'src/components/tabs.tsx': lines(
        'export const Tabs = () => (',
        '  <TabsContent value="games" forceMount>',
        '    <Games />',
        '  </TabsContent>',
        ');',
      ),
      'src/components/dialog.tsx': lines(
        'export const Box = () => <DialogContent forceMount={true}><Body /></DialogContent>;',
        'export const contentProps = { forceMount: true as const };',
      ),
    });
    expect(keptMounted).toEqual([
      'src/components/dialog.tsx:1 <DialogContent forceMount> keeps content mounted while it is not shown',
      'src/components/dialog.tsx:2 a forceMount prop keeps content mounted while it is not shown',
      'src/components/tabs.tsx:2 <TabsContent forceMount> keeps content mounted while it is not shown',
    ]);
  });

  it('passes content left to unmount and an explicit forceMount={false}', async () => {
    const { keptMounted } = await run({
      'src/components/tabs.tsx': lines(
        'export const Tabs = () => (',
        '  <TabsContent value="games">',
        '    <Games />',
        '  </TabsContent>',
        ');',
        'export const Box = () => <DialogContent forceMount={false} />;',
      ),
    });
    expect(keptMounted).toEqual([]);
  });
});

describe('the readsOnlyWhenShown facts', () => {
  it('refuses a reviewed read ahead with no why, an empty why, or no call, and a missing list', () => {
    expect(
      readsOnlyWhenShownGuard.factProblems({
        readsAhead: [
          { path: 'src/a.tsx', call: 'prefetchQuery(a)', why: '' },
          {
            path: 'src/b.tsx',
            call: 'prefetchQuery(b)',
          } as ReadsOnlyWhenShownFacts['readsAhead'][number],
          { path: 'src/c.tsx', call: '', why: 'why' },
        ],
      }),
    ).toEqual([
      'readsAhead entry src/a.tsx prefetchQuery(a) carries no why',
      'readsAhead entry src/b.tsx prefetchQuery(b) carries no why',
      'readsAhead entry src/c.tsx names no call',
    ]);
    expect(readsOnlyWhenShownGuard.factProblems({} as ReadsOnlyWhenShownFacts)).toEqual([
      'readsAhead is missing (declare [] when there is none)',
    ]);
  });

  it("proves each guard's matcher on its samples", () => {
    for (const guard of readsOnlyWhenShownGuard.build(facts())) {
      expect(() => checkSamples(guard)).not.toThrow();
    }
  });
});
