// The query-cache guards: saved reads are refreshed, removed, or reset only through the domain-event
// registry and only at keys a live query reads, never an infinite list; no action reloads an
// infinite list; a whole-cache drop only in the session-retirement owner; and a registry whose
// events are produced, well formed, and awaited.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  domainEventRegistryGuard,
  queryCacheGuard,
  type DomainEventRegistryFacts,
  type QueryCacheFacts,
} from '../../src/modules/frontend-reads/cache.js';
import { runDefinition } from './run.js';
import { runGuard } from '../../src/node/suite/run.js';
import { createRepoReader } from '../../src/node/reader.js';
import { tempRepo } from '../helpers/temp-repo.js';

const KEYS = 'src/lib/query-keys.ts';
const REGISTRY = 'src/lib/registry.ts';
const OWNER = 'src/lib/session-retirement.ts';

/** The app's key objects as its loader hands them over; `tokens` builds strings, so it is no key object. */
const keyExports = {
  thingKeys: {
    all: ['things'],
    detail: (id: string) => ['things', 'detail', id],
    list: (filter: string) => ['things', 'list', filter],
    listPrefix: () => ['things', 'list'],
    files: (id: string) => ['things', 'files', id],
    folders: (id: string) => ['things', 'files', id, 'folders'],
    orphan: (id: string) => ['things', 'orphan', id],
    thread: (id: string, uid: string) => ['things', 'thread', id, uid],
  },
  personLookupKeys: { all: ['person'], detail: (id: string) => ['person', id] },
  tokens: { chapter: (id: string) => `chapter/${id}` },
};
const keyModule = { path: KEYS, load: () => keyExports };

const READS = [
  'useQuery({ queryKey: thingKeys.detail(id) });',
  'useQuery({ queryKey: thingKeys.folders(id) });',
  'useQuery({ queryKey: thingKeys.thread(id, uid) });',
  'useInfiniteQuery<P, E, InfiniteData<P>, ReturnType<typeof thingKeys.list>>({',
  '  queryKey: thingKeys.list(filter),',
  '});',
  'queryClient.refetchQueries({ queryKey: thingKeys.orphan(id) });',
  'createLookup({ keys: personLookupKeys });',
].join('\n');

const registrySource = (entries: string) =>
  [
    'const REGISTRY = {',
    `  'thing.changed': ({ id, uid }) => [${entries}],`,
    '};',
    'const invalidator = createDomainEventInvalidator<Ev>(REGISTRY);',
    'export function notify(qc, e) { return invalidator.notify(qc, e); }',
    'export function run(qc) { return qc.invalidateQueries({ queryKey }); }',
  ].join('\n');

/** The session-retirement owner: it cancels and clears on a session's end, and retires one group by predicate. */
const OWNER_SOURCE = [
  'await qc.cancelQueries();',
  'qc.getQueryCache().clear();',
  'await qc.cancelQueries({ predicate: namesGroup });',
  'qc.removeQueries({ predicate: namesGroup });',
].join('\n');

const facts = (overrides: Partial<QueryCacheFacts> = {}): QueryCacheFacts => ({
  registry: { path: REGISTRY },
  keyModule,
  readTrees: ['src/hooks'],
  familySuffix: 'Prefix',
  loadedPagesPredicate: 'keepsPages',
  memberRefreshes: [],
  refreshHandoffs: [],
  sessionOwner: OWNER,
  predicateRetirements: [{ trigger: 'a member leaving a group', why: 'the reads the member lost' }],
  ...overrides,
});

const clean = {
  [REGISTRY]: registrySource(
    'exact(thingKeys.detail(id)), prefix(thingKeys.files(id)), exact(personLookupKeys.detail(id)), exact(thingKeys.thread(id, uid)), exact(thingKeys.detail(tokens.chapter(id)))',
  ),
  'src/hooks/use-things.tsx': READS,
  [OWNER]: OWNER_SOURCE,
};

/** The findings of the guards `queryCache` builds, by name. */
async function run(overrides: Partial<QueryCacheFacts>, files: Record<string, string>) {
  const [registryRule, targets, listReload, sessionRetirement] = await runDefinition(
    queryCacheGuard,
    facts(overrides),
    files,
  );
  return { registryRule, targets, listReload, sessionRetirement };
}

describe('saved reads change only through the domain-event registry, at keys a live query reads', () => {
  it('passes a clean app: the registry, its read targets, the session-retirement owner, and nothing else', async () => {
    expect(await run({}, clean)).toEqual({
      registryRule: [],
      targets: [],
      listReload: [],
      sessionRetirement: [],
    });
  });

  it('flags an invalidate, remove, or reset call outside the registry, a receiver on its own line included — with no exception list', async () => {
    const { registryRule } = await run(
      {},
      {
        ...clean,
        'src/hooks/a.ts': 'queryClient.invalidateQueries({ queryKey: thingKeys.detail(id) });',
        'src/hooks/b.ts': 'queryClient\n  .removeQueries({ queryKey: thingKeys.detail(id) });',
        'src/hooks/c.ts':
          'client.resetQueries({ queryKey: thingKeys.detail(id) });\n// queryClient.invalidateQueries(…) in prose',
      },
    );
    expect(registryRule).toEqual([
      {
        file: 'src/hooks/a.ts',
        line: 1,
        detail: 'outside the registry: invalidateQueries({ queryKey: thingKeys.detail(id) })',
      },
      {
        file: 'src/hooks/b.ts',
        line: 2,
        detail: 'outside the registry: removeQueries({ queryKey: thingKeys.detail(id) })',
      },
      {
        file: 'src/hooks/c.ts',
        line: 1,
        detail: 'outside the registry: resetQueries({ queryKey: thingKeys.detail(id) })',
      },
    ]);
  });

  it("leaves the session-retirement owner's removal and a person's own declared refresh to their own rules", async () => {
    const memberRefreshes = [
      {
        path: 'src/lib/feed.ts',
        call: 'resetQueries({ queryKey: feedKey })',
        why: 'pull-to-refresh of the visible feed',
      },
    ];
    const { registryRule } = await run(
      { memberRefreshes },
      { ...clean, 'src/lib/feed.ts': 'qc.resetQueries({ queryKey: feedKey });' },
    );
    expect(registryRule).toEqual([]);
  });

  it('flags a registry that hands nothing to the registry factory', async () => {
    const { registryRule, targets } = await run(
      {},
      {
        [REGISTRY]: 'export const REGISTRY = {};',
        'src/hooks/use-things.tsx': READS,
        [OWNER]: OWNER_SOURCE,
      },
    );
    const detail = 'no registry object handed to createDomainEventInvalidator';
    expect(registryRule).toEqual([{ file: REGISTRY, detail }]);
    expect(targets).toEqual([{ file: REGISTRY, detail }]);
  });

  it('flags a target nothing reads (a refetch is no reader), an exact on a family, an exact shaped unlike every read, and a target reaching an infinite list', async () => {
    const { targets } = await run(
      {},
      {
        ...clean,
        [REGISTRY]: registrySource(
          'exact(thingKeys.detail(id)), exact(thingKeys.orphan(id)), prefix(thingKeys.listPrefix()), prefix(thingKeys.all), exact(thingKeys.thread(id)), exact(personLookupKeys.all)',
        ),
      },
    );
    expect(targets).toEqual([
      { file: REGISTRY, detail: 'thingKeys.orphan: no live query reads this key' },
      {
        file: REGISTRY,
        detail:
          'thingKeys.thread: an exact target built with 1 argument(s), which no live read builds',
      },
      {
        file: REGISTRY,
        detail:
          'personLookupKeys.all: an exact target on a key family (only a prefix target reaches a family)',
      },
      { file: REGISTRY, detail: 'thingKeys.listPrefix: reaches an infinite list' },
      { file: REGISTRY, detail: 'thingKeys.all: reaches an infinite list' },
    ]);
  });

  it('reads an argument count whatever the layout: a trailing comma adds no argument, and a wrapped read still counts', async () => {
    const { targets } = await run(
      {},
      {
        ...clean,
        [REGISTRY]: registrySource(
          'exact(\n  thingKeys.thread(\n    id,\n    uid,\n  ),\n), exact(thingKeys.folders(id, extra))',
        ),
        'src/hooks/use-wrapped.tsx': 'const queryKey = thingKeys.folders(\n  id,\n  extra,\n);',
      },
    );
    expect(targets).toEqual([]);
  });

  it('flags a read tree it cannot reach', async () => {
    const { targets } = await run({ readTrees: ['src/hooks', 'src/pages'] }, clean);
    expect(targets).toEqual([
      {
        file: 'src/pages',
        detail:
          'the tree holds no production code the guard can read (moved, or not under the app root)',
      },
    ]);
  });
});

describe('an action never reloads an infinite list', () => {
  it("passes a reload of a key that is no list, a predicate that spares loaded pages, an in-place patch, and a person's declared refresh", async () => {
    const memberRefreshes = [
      { path: 'src/lib/a.ts', call: 'resetQueries({ queryKey: feedKey })', why: 'pull-to-refresh' },
    ];
    const { listReload } = await run(
      { memberRefreshes },
      {
        ...clean,
        'src/lib/a.ts': [
          'qc.refetchQueries({ queryKey: thingKeys.detail(id) });',
          'qc.setQueryData(k, (d) => ({ ...d, pages: d.pages.map(patch) }));',
          'const PAGE_KEYS = { a: thingKeys.detail(x) };\nqc.refetchQueries({ queryKey: PAGE_KEYS[id] });',
          'qc.resetQueries({ queryKey: feedKey });',
          '// qc.resetQueries({ queryKey: thingKeys.list(f) })',
        ].join('\n'),
      },
    );
    expect(listReload).toEqual([]);
  });

  it('flags a reload reaching an infinite list directly, through its family helper, its scope, or a constant map, and an unresolved key', async () => {
    const { listReload } = await run(
      {},
      {
        ...clean,
        'src/lib/a.ts': [
          'qc.resetQueries({ queryKey: thingKeys.list(f) });',
          'qc.refetchQueries({ queryKey: thingKeys.listPrefix() });',
          'qc.removeQueries({ queryKey: thingKeys.all });',
          'const PAGE_KEYS = { a: thingKeys.detail(x), b: thingKeys.all };',
          'qc.refetchQueries({ queryKey: PAGE_KEYS[id] });',
          'qc.resetQueries({ queryKey: someKey });',
          "qc.refetchQueries({ type: 'active' });",
          'qc.resetQueries({ predicate: (query) => refused.has(query) });',
        ].join('\n'),
      },
    );
    expect(listReload).toEqual([
      {
        file: 'src/lib/a.ts',
        line: 1,
        detail: 'reloads an infinite list: resetQueries({ queryKey: thingKeys.list(f) })',
      },
      {
        file: 'src/lib/a.ts',
        line: 2,
        detail: 'reloads an infinite list: refetchQueries({ queryKey: thingKeys.listPrefix() })',
      },
      {
        file: 'src/lib/a.ts',
        line: 3,
        detail: 'reloads an infinite list: removeQueries({ queryKey: thingKeys.all })',
      },
      {
        file: 'src/lib/a.ts',
        line: 5,
        detail: 'reloads an infinite list: refetchQueries({ queryKey: PAGE_KEYS[id] })',
      },
      {
        file: 'src/lib/a.ts',
        line: 6,
        detail: 'reloads queries its key does not name: resetQueries({ queryKey: someKey })',
      },
      {
        file: 'src/lib/a.ts',
        line: 7,
        detail: "reloads queries its key does not name: refetchQueries({ type: 'active' })",
      },
      {
        file: 'src/lib/a.ts',
        line: 8,
        detail:
          'reloads queries its key does not name: resetQueries({ predicate: (query) => refused.has(query) })',
      },
    ]);
  });

  it('flags a cache write that trims a list to its first page', async () => {
    const { listReload } = await run(
      {},
      {
        ...clean,
        'src/lib/a.ts':
          'qc.setQueryData(k, (d) => ({ pages: d.pages.slice(0, 1), pageParams: d.pageParams.slice(0, 1) }));\nqc.setQueriesData<D>({ queryKey: k }, (d) => d && { ...d, pages: [d.pages[0]] });',
      },
    );
    expect(listReload.map((f) => [f.line, f.detail.split(':')[0]])).toEqual([
      [1, 'trims a list to its first page'],
      [2, 'trims a list to its first page'],
    ]);
  });

  it('flags a second call beside a declared refresh, and a declared refresh that is gone', async () => {
    const memberRefreshes = [
      { path: 'src/lib/a.ts', call: 'resetQueries({ queryKey: feedKey })', why: 'pull-to-refresh' },
      { path: 'src/lib/b.ts', call: "refetchQueries({ type: 'active' })", why: 'gone' },
    ];
    const { listReload } = await run(
      { memberRefreshes },
      {
        ...clean,
        'src/lib/a.ts':
          'qc.resetQueries({ queryKey: feedKey });\nqc.resetQueries({ queryKey: otherKey });',
      },
    );
    expect(listReload).toEqual([
      {
        file: 'src/lib/a.ts',
        line: 2,
        detail: 'reloads queries its key does not name: resetQueries({ queryKey: otherKey })',
      },
      {
        file: 'src/lib/b.ts',
        detail: "stale member refresh: refetchQueries({ type: 'active' }) is no longer there",
      },
    ]);
  });

  it("flags a refresh hook's result used other than on its refresh control, and a hook nothing calls", async () => {
    const refreshHandoffs = [
      { hook: 'useRefreshRows', control: 'RefetchButton', prop: 'onRefetch' },
      { hook: 'useRefreshGone', control: 'RefetchButton', prop: 'onRefetch' },
    ];
    const { listReload } = await run(
      { refreshHandoffs },
      {
        ...clean,
        'src/components/a.tsx':
          'const refresh = useRefreshRows(id);\nreturn <RefetchButton onRefetch={refresh} />;',
        'src/components/b.tsx':
          'const refresh = useRefreshRows(id);\nconst save = () => refresh();',
      },
    );
    expect(listReload).toEqual([
      {
        file: 'src/components/b.tsx',
        line: 1,
        detail: "useRefreshRows()'s refresh is used other than as <RefetchButton onRefetch>",
      },
      { file: '(refreshHandoffs)', detail: 'stale entry: nothing calls useRefreshGone' },
    ]);
  });

  it('flags an app in which it finds no infinite list', async () => {
    const { listReload } = await run(
      {},
      { ...clean, 'src/hooks/use-things.tsx': 'useQuery({ queryKey: thingKeys.detail(id) });' },
    );
    expect(listReload).toEqual([
      { file: KEYS, detail: 'no infinite list found in the app, so the guard checks nothing' },
    ]);
  });
});

describe('an unscoped cancel or a whole-cache clear runs only in the session-retirement owner', () => {
  it('passes the owner and a key-scoped cancel elsewhere', async () => {
    const { sessionRetirement } = await run(
      {},
      {
        ...clean,
        'src/hooks/a.ts':
          'await qc.cancelQueries({ queryKey: key, exact: true });\ntimers.clear();',
      },
    );
    expect(sessionRetirement).toEqual([]);
  });

  it('flags every whole-cache drop shape outside the owner', async () => {
    const { sessionRetirement } = await run(
      {},
      {
        ...clean,
        'src/hooks/a.ts': [
          'await queryClient.cancelQueries();',
          'queryClient.cancelQueries(undefined, opts);',
          'void queryClient.cancelQueries({ predicate: (q) => true });',
          'qc.getQueryCache().clear();',
          'qc.getMutationCache().clear();',
          'queryClient.clear();',
        ].join('\n'),
      },
    );
    expect(sessionRetirement.map((f) => `${f.line} ${f.detail}`)).toEqual([
      '1 outside the session-retirement owner: cancelQueries()',
      '2 outside the session-retirement owner: cancelQueries(undefined',
      '3 outside the session-retirement owner: cancelQueries({',
      '4 outside the session-retirement owner: getQueryCache().clear(',
      '5 outside the session-retirement owner: getMutationCache().clear(',
      '6 outside the session-retirement owner: queryClient.clear()',
    ]);
  });

  it('flags an owner that stopped retiring a session, and one whose predicate retirements differ from the reviewed ones', async () => {
    const { sessionRetirement } = await run(
      {},
      { ...clean, [OWNER]: 'await qc.cancelQueries({ queryKey: k });' },
    );
    expect(sessionRetirement).toEqual([
      { file: OWNER, detail: 'the owner no longer cancels every query when a session ends' },
      { file: OWNER, detail: 'the owner no longer clears the query cache when a session ends' },
      {
        file: OWNER,
        detail: 'the owner cancels by predicate 0 time(s); 1 predicate retirement(s) are reviewed',
      },
    ]);
    const { [OWNER]: _gone, ...withoutOwner } = clean;
    expect((await run({}, withoutOwner)).sessionRetirement).toEqual([
      { file: OWNER, detail: 'the session-retirement owner no longer exists' },
    ]);
  });
});

describe('the query-cache facts', () => {
  it('refuses a missing key-module loader, a family suffix, a loaded-pages predicate, a hand-off control, a session owner, a retirement why, and a stray-whitespace refresh', () => {
    expect(
      queryCacheGuard.factProblems(
        facts({
          keyModule: { path: KEYS } as never,
          familySuffix: '',
          loadedPagesPredicate: '',
          refreshHandoffs: [{ hook: 'useR', control: '', prop: 'onRefetch' }],
          sessionOwner: '',
          predicateRetirements: [{ trigger: 'leave', why: '' }],
          memberRefreshes: [{ path: 'src/a.ts', call: 'resetQueries( { queryKey } )', why: 'x' }],
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        'keyModule.load needs a loader function',
        'familySuffix must be an identifier',
        'loadedPagesPredicate must be an identifier',
        'refreshHandoffs[0].control must be an identifier',
        'memberRefreshes entry src/a.ts resetQueries( { queryKey } ): write the call whitespace-collapsed (resetQueries({ queryKey }))',
        'predicateRetirements entry leave carries no why',
      ]),
    );
    expect(
      queryCacheGuard
        .factProblems(facts({ sessionOwner: '' }))
        .some((p) => p.startsWith('sessionOwner')),
    ).toBe(true);
  });
});

describe('the domain-event registry: produced, registered, well formed, and awaited', () => {
  const schema = z.discriminatedUnion('type', [
    z.object({
      type: z.literal('thing.changed'),
      ids: z.object({ id: z.string(), filter: z.string().optional() }),
    }),
    z.object({
      type: z.literal('thing.gone'),
      ids: z.object({ id: z.string(), kind: z.enum(['a', 'b']) }),
    }),
  ]);
  const good = {
    'thing.changed': ({ id }: { id: string }) => [{ kind: 'exact', queryKey: ['things', id] }],
    'thing.gone': () => [{ kind: 'predicate', description: 'every thing', match: () => true }],
  };
  const facts = (
    overrides: Partial<DomainEventRegistryFacts> = {},
    registry: Record<string, unknown> = good,
  ): DomainEventRegistryFacts => ({
    registry: { path: REGISTRY, load: () => registry },
    eventSchema: () => schema,
    notifiers: ['notifyThing'],
    ...overrides,
  });
  const producers = {
    [REGISTRY]: "const REGISTRY = { 'thing.changed': f, 'thing.gone': g };",
    'src/hooks/use-thing.ts':
      "export function useThing() { return useMutation({ onSuccess: () => notifyThing(qc, { type: 'thing.changed', ids }) }); }",
    'functions/src/gone.ts': 'export const events = [{ type: "thing.gone", ids }];',
  };

  it('passes a registry whose events are all produced (client or functions), registered, well formed, and awaited', async () => {
    const findings = await runDefinition(domainEventRegistryGuard, facts(), {
      ...producers,
      'src/hooks/use-other.ts': [
        'export function notifyThing(qc, e) { return run(qc, e); }',
        '{ await notifyThing(qc, e); }',
        '{ void notifyThing(qc, e); }',
        '{ const r = notifyThing(qc, e); }',
        'refreshes.push(\n  notifyThing(qc, e),\n);',
      ].join('\n'),
    });
    expect(findings).toEqual([[], [], []]);
  });

  it('flags a registered event with no producer, with no way to park it — the registry and test code are no evidence', async () => {
    const [produced] = await runDefinition(
      domainEventRegistryGuard,
      facts({ noProducerYet: [{ event: 'thing.gone', why: 'producer lands later' }] } as never),
      {
        [REGISTRY]: producers[REGISTRY],
        'src/hooks/use-thing.ts': producers['src/hooks/use-thing.ts'],
        'src/hooks/use-thing.test.ts': "emit('thing.gone');",
      },
    );
    expect(produced).toEqual([{ file: REGISTRY, detail: 'thing.gone: no producer in the app' }]);
  });

  it('flags a variant with no entry, and entries whose answer is malformed for some shape of their ids', async () => {
    const malformed = {
      'thing.changed': ({ filter }: { filter?: string }) => {
        if (filter === undefined) throw new Error('needs a filter');
        return [{ kind: 'exact', queryKey: [] }];
      },
    };
    const [, registered] = await runDefinition(
      domainEventRegistryGuard,
      facts({}, malformed),
      producers,
    );
    expect(registered).toEqual([
      { file: REGISTRY, detail: 'thing.changed: a exact invalidation with no key' },
      { file: REGISTRY, detail: 'thing.changed: throws for ids {"id":"test-id"}: needs a filter' },
      { file: REGISTRY, detail: 'thing.gone: no registry entry' },
    ]);
    const odd = {
      ...good,
      'thing.gone': () => [{ kind: 'predicate', match: () => true }, { kind: 'other' }],
    };
    const [, second] = await runDefinition(domainEventRegistryGuard, facts({}, odd), producers);
    expect(second).toEqual([
      {
        file: REGISTRY,
        detail: 'thing.gone: a predicate invalidation with no description or matcher',
      },
    ]);
  });

  it('flags an entry whose action or refetchType query-core does not carry, and a remove or reset that carries a refetchType', async () => {
    const answers = (inv: Record<string, unknown>) => ({ ...good, 'thing.gone': () => [inv] });
    const flagged = async (inv: Record<string, unknown>) =>
      (await runDefinition(domainEventRegistryGuard, facts({}, answers(inv)), producers))[1];
    expect(await flagged({ kind: 'exact', queryKey: ['t'], action: 'drop' })).toEqual([
      { file: REGISTRY, detail: 'thing.gone: a exact invalidation with unknown action drop' },
    ]);
    expect(await flagged({ kind: 'prefix', queryKey: ['t'], refetchType: 'some' })).toEqual([
      { file: REGISTRY, detail: 'thing.gone: a prefix invalidation with unknown refetchType some' },
    ]);
    expect(
      await flagged({ kind: 'exact', queryKey: ['t'], action: 'remove', refetchType: 'all' }),
    ).toEqual([
      {
        file: REGISTRY,
        detail: 'thing.gone: a remove invalidation with a refetchType, which only a refresh takes',
      },
    ]);
    for (const inv of [
      { kind: 'exact', queryKey: ['t'], action: 'remove', refetchType: undefined },
      { kind: 'prefix', queryKey: ['t'], action: 'reset' },
      {
        kind: 'predicate',
        description: 'all',
        match: () => true,
        action: 'refresh',
        refetchType: 'none',
      },
    ]) {
      expect(await flagged(inv)).toEqual([]);
    }
  });

  it('flags a schema loader that answers no union', async () => {
    const [, registered] = await runDefinition(
      domainEventRegistryGuard,
      facts({ eventSchema: () => z.string() }),
      producers,
    );
    expect(registered).toEqual([
      {
        file: '(eventSchema)',
        detail: 'the loader did not answer a discriminated union of variants',
      },
    ]);
  });

  it('flags a notification in statement position, and an app that never notifies', async () => {
    const [, , awaited] = await runDefinition(domainEventRegistryGuard, facts(), {
      ...producers,
      'src/hooks/use-drop.ts':
        'onSuccess: () => {\n  notifyThing(qc, e);\n}\nif (x) notifyThing(qc, e);',
    });
    expect(awaited).toEqual([
      {
        file: 'src/hooks/use-drop.ts',
        line: 2,
        detail: 'notifyThing(…) in statement position drops its refresh',
      },
      {
        file: 'src/hooks/use-drop.ts',
        line: 4,
        detail: 'notifyThing(…) in statement position drops its refresh',
      },
    ]);
    const [, , none] = await runDefinition(
      domainEventRegistryGuard,
      facts({ notifiers: ['notifyNothing'] }),
      producers,
    );
    expect(none).toEqual([
      {
        file: '(notifiers)',
        detail: 'nothing in the app calls notifyNothing, so the guard checks nothing',
      },
    ]);
  });

  it('refuses facts with no registry loader, no schema loader, or no notifier', () => {
    expect(
      domainEventRegistryGuard.factProblems({
        registry: { path: REGISTRY } as never,
        eventSchema: undefined as never,
        notifiers: [],
      }),
    ).toEqual([
      'registry.load needs a loader function',
      'eventSchema needs a loader function',
      'notifiers is empty',
    ]);
  });

  it('the variant check reads the registry file, so the suite counts it as having read the repository, and fails without it', async () => {
    const variantGuard = domainEventRegistryGuard.build(facts())[1];
    const suiteRun = async (files: Record<string, string>) => {
      const repo = tempRepo({ 'src/anchor.ts': 'export {};', ...files });
      try {
        await runGuard(
          variantGuard,
          createRepoReader({
            repoRoot: repo.root,
            roots: { app: { path: 'src', anchor: 'src/anchor.ts' } },
          }),
        );
        return null;
      } catch (err) {
        return (err as Error).message;
      } finally {
        repo.remove();
      }
    };
    expect(await suiteRun({ [REGISTRY]: 'export const REGISTRY = {};' })).toBeNull();
    expect(await suiteRun({})).toMatch(/^every core domain-event variant has a registry entry/);
  });
});
