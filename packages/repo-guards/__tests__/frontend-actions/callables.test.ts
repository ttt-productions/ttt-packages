// The callable guards: one copy owner, one transport owner, reads that live in hooks and keep
// neither the wrapper toast nor its capture, one surface per rejection, and no rendered error internals.

import { describe, expect, it } from 'vitest';
import {
  callableErrorCopyGuard,
  callableReadGuard,
  callableTransportGuard,
  doubleSurfaceGuard,
  errorInternalsGuard,
  type CallableReadFacts,
  type DoubleSurfaceFacts,
} from '../../src/modules/frontend-actions/callables.js';
import { findingsOf, samplesProve } from './run.js';

const lines = (...l: string[]) => l.join('\n');

// ---------------------------------------------------------------------------------------------
describe('callable error copy owner', () => {
  const facts = {
    owner: { file: 'src/lib/policy.ts', exportName: 'describeFailure' },
    allowlist: [{ path: 'src/forms/local-check.tsx', why: 'a local validation error, not a callable rejection' }],
  };
  const base = {
    'src/lib/policy.ts': lines('export function describeFailure(error: unknown) {', '  return { description: error.message };', '}'),
    'src/forms/local-check.tsx': "toast({ title: 'Invalid', description: error.message });",
    'src/ok.tsx': "toast({ title: 'Failed', description: describeFailure(error) });\n<p>{errors.title.message}</p>",
  };

  it('passes routed copy, the owner itself, and a reviewed surface', async () => {
    expect(await findingsOf(callableErrorCopyGuard, facts, base)).toEqual([]);
  });

  it('flags every raw-message surface shape', async () => {
    const bad = lines(
      "toast({ title: 'Failed', description: error.message });",
      "toast({ title: rosterError.message, variant: 'destructive' });",
      'onError: (e) => setSaveError(e.message),',
      "const m = error instanceof Error ? error.message : 'Failed.';",
      "? linkError?.message || 'Expired.'",
      '<div>Error: {errorContent.message}</div>',
    );
    expect(await findingsOf(callableErrorCopyGuard, facts, { ...base, 'src/bad.tsx': bad })).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => `src/bad.tsx:${n} not on the reviewed list: raw error message`),
    );
  });

  it('flags a reviewed entry that no longer holds the shape', async () => {
    const findings = await findingsOf(callableErrorCopyGuard, facts, { ...base, 'src/forms/local-check.tsx': 'export {};' });
    expect(findings).toEqual(['src/forms/local-check.tsx stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)']);
  });

  it('flags an owner that no longer exports the copy function, and an owner that is gone', async () => {
    expect(await findingsOf(callableErrorCopyGuard, facts, { ...base, 'src/lib/policy.ts': 'export const other = 1;' })).toEqual([
      'src/lib/policy.ts the copy owner no longer exports describeFailure',
    ]);
    const { ['src/lib/policy.ts']: _gone, ...withoutOwner } = base;
    expect(await findingsOf(callableErrorCopyGuard, facts, withoutOwner)).toEqual(['src/lib/policy.ts the copy owner no longer exists']);
  });

  it('proves its samples', () => samplesProve(callableErrorCopyGuard, facts));

  it('refuses a missing owner, an empty export name, and an entry with no why', () => {
    expect(callableErrorCopyGuard.factProblems({ allowlist: [] } as never)).toEqual(['owner is missing']);
    expect(callableErrorCopyGuard.factProblems({ owner: { file: 'a.ts', exportName: '' }, allowlist: [{ path: 'b.ts', why: '' }] })).toEqual([
      'owner.exportName is missing',
      'allowlist entry b.ts carries no why',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('callable transport through its owner', () => {
  const facts = {
    transports: [
      { module: 'firebase/functions', symbols: ['httpsCallable', 'getFunctions'], owner: 'src/lib/fb.ts' },
      { module: '@kit/helpers', symbols: ['callRemote'], owner: 'src/lib/policy.ts' },
    ],
  };
  const base = {
    'src/lib/fb.ts': "import { getFunctions } from 'firebase/functions';\nexport const functions = getFunctions(app);",
    'src/lib/policy.ts': "import { callRemote } from '@kit/helpers/client';\nexport const call = (n: string) => callRemote(n);",
    'src/ok.tsx': "import { call } from '@/lib/policy';\n// httpsCallable(functions, 'x') in prose\nconst getFunctionsLabel = 'getFunctions';",
  };

  it('passes the owners and their consumers', async () => {
    expect(await findingsOf(callableTransportGuard, facts, base)).toEqual([]);
  });

  it('flags a named, aliased, subpath, namespace, re-exported, and bare reach outside the owner', async () => {
    const files = {
      ...base,
      'src/a.ts': "import { httpsCallable as hc } from 'firebase/functions';",
      'src/b.ts': "import { callRemote } from '@kit/helpers/client';",
      'src/c.ts': "import * as fns from 'firebase/functions';\nconst f = fns.getFunctions;",
      'src/d.ts': "export { httpsCallable } from 'firebase/functions';",
      'src/e.ts': "await httpsCallable(functions, 'go')({});",
      'src/lib/fb.ts': "import { getFunctions } from 'firebase/functions';\nexport const functions = getFunctions(app);\ncallRemote('x');",
    };
    expect(await findingsOf(callableTransportGuard, facts, files)).toEqual([
      'src/a.ts:1 outside its owner src/lib/fb.ts: imports httpsCallable from firebase/functions',
      'src/b.ts:1 outside its owner src/lib/policy.ts: imports callRemote from @kit/helpers/client',
      'src/c.ts:2 outside its owner src/lib/fb.ts: reaches fns.getFunctions',
      'src/d.ts:1 outside its owner src/lib/fb.ts: imports httpsCallable from firebase/functions',
      'src/e.ts:1 outside its owner src/lib/fb.ts: calls httpsCallable(',
      'src/lib/fb.ts:3 outside its owner src/lib/policy.ts: calls callRemote(',
    ]);
  });

  it('flags an owner that no longer names its transport, and one that is gone', async () => {
    const { ['src/lib/policy.ts']: _gone, ...rest } = base;
    expect(await findingsOf(callableTransportGuard, facts, { ...rest, 'src/lib/fb.ts': 'export {};' })).toEqual([
      'src/lib/fb.ts stale owner: it no longer names any of httpsCallable, getFunctions',
      'src/lib/policy.ts the transport owner no longer exists',
    ]);
  });

  it('refuses no transports, and a transport with no owner or symbols', () => {
    expect(callableTransportGuard.factProblems({ transports: [] })).toEqual(['transports is missing or empty']);
    expect(callableTransportGuard.factProblems({ transports: [{ module: 'm', symbols: [], owner: '' }] })).toEqual([
      "transport m's owner is missing",
      "transport m's symbols is empty",
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('callable-backed reads', () => {
  const facts: CallableReadFacts = {
    hooksRoot: 'src/hooks',
    wrappers: [{ hook: 'useFunctions', invokeMember: 'callFunction', toastOption: 'showErrorToast', captureOption: 'captureErrors' }],
    factoryModules: [
      {
        module: 'src/lib/callables.ts',
        factories: [
          { name: 'createReader', kind: 'reader' },
          { name: 'createHook', kind: 'mutation' },
          { name: 'createInvoker', kind: 'invoker' },
        ],
      },
    ],
    readFailureSurface: { component: 'LoadErrorState', errorProp: 'error' },
    anchorReads: ['useAnchorRead'],
  };
  const base = {
    'src/lib/callables.ts': lines(
      'export const useGetThing = createReader<In, Out>("getThing");',
      'export const useSaveThing =',
      '  createHook<In, Out>("saveThing");',
      'export const useArchiveThing = createInvoker<In, Out>("archiveThing");',
    ),
    'src/hooks/use-anchor.ts': lines(
      'export function useAnchorRead(id: string) {',
      '  const { callFunction } = useFunctions({ showErrorToast: false, captureErrors: false });',
      "  return useQuery({ queryKey: k(id), queryFn: () => callFunction('getAnchor', { id }) });",
      '}',
    ),
  };
  const hook = (body: string) => findingsOf(callableReadGuard, facts, { ...base, 'src/hooks/use-thing.ts': body });

  it('passes opted-out reads, a reader read, a mutation, and a Firestore read beside a mutation-only callable', async () => {
    const files = {
      ...base,
      'src/hooks/use-const.ts': lines(
        'const READ = { showErrorToast: false, captureErrors: false } as const;',
        'export function useConst() {',
        '  const { callFunction } = useFunctions(READ);',
        "  return useQuery({ queryKey: k(), queryFn: () => callFunction('x', {}) });",
        '}',
      ),
      'src/hooks/use-reader.ts': lines(
        'export function useReaderRead(id: string) {',
        '  const readThing = useGetThing();',
        '  const load = async () => (await readThing({ id })).items;',
        '  return useQuery({ queryKey: k(id), queryFn: load });',
        '}',
      ),
      'src/hooks/use-write.ts': lines(
        'export function useDoThing() {',
        '  const { callFunction } = useFunctions();',
        "  return useMutation({ mutationFn: (v: V) => callFunction('doThing', v) });",
        '}',
        'export function useManager(id: string) {',
        '  const { callFunction } = useFunctions();',
        "  const read = useQuery({ queryKey: k(id), queryFn: () => getDoc(doc(db, 'things', id)) });",
        "  const write = useMutation({ mutationFn: () => callFunction('save', { id }) });",
        '  return { read, write };',
        '}',
      ),
      'src/components/view.tsx': lines(
        'export function View({ id }: { id: string }) {',
        '  const anchor = useAnchorRead(id);',
        '  return anchor.isError ? <LoadErrorState thing="x" error={anchor.error} /> : null;',
        '}',
      ),
      'src/components/other.tsx': lines(
        'export function Other() {',
        "  const { data: grant } = useAnchorRead('x');",
        '  const { isError } = useOtherRead();',
        '  return isError ? <LoadErrorState thing="y" /> : null;',
        '}',
      ),
    };
    expect(await findingsOf(callableReadGuard, facts, files)).toEqual([]);
  });

  it('flags a bare wrapper read: it keeps the toast and the capture', async () => {
    expect(
      await hook(lines('export function useThing(id: string) {', '  const { callFunction } = useFunctions();', "  return useQuery<Thing[], Error>({ queryKey: k(id), queryFn: () => callFunction('get', { id }) });", '}')),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (callFunction) keeps the wrapper toast', 'src/hooks/use-thing.ts:3 useThing (callFunction) keeps the wrapper capture']);
  });

  it('flags a toast-only opt-out: the capture is still doubled', async () => {
    expect(
      await hook(lines('export function useThing() {', '  const { callFunction } = useFunctions({ showErrorToast: false });', "  return useQuery({ queryKey: k(), queryFn: () => callFunction('get', {}) });", '}')),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (callFunction) keeps the wrapper capture']);
  });

  it('flags options it cannot see, and a same-file constant that keeps the defaults', async () => {
    expect(
      await hook(lines('export function useThing() {', '  const { callFunction } = useFunctions(importedOptions);', "  return useQuery({ queryKey: k(), queryFn: () => callFunction('get', {}) });", '}')),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (callFunction) passes wrapper options that are not statically visible']);
    expect(
      await hook(
        lines('const OPTS = { limitedUseAppCheck: true } as const;', 'export function useThing() {', '  const { callFunction } = useFunctions(OPTS);', "  return useQuery({ queryKey: k(), queryFn: () => callFunction('get', {}) });", '}'),
      ),
    ).toEqual(['src/hooks/use-thing.ts:4 useThing (callFunction) keeps the wrapper toast', 'src/hooks/use-thing.ts:4 useThing (callFunction) keeps the wrapper capture']);
  });

  it('flags an aliased binding, a whole-result binding, a block-local helper, and an infinite read with nested generics', async () => {
    expect(
      await hook(lines('export function useThing() {', '  const { callFunction: callAdmin } = useFunctions({ showErrorToast: false });', "  return useQuery({ queryKey: k(), queryFn: () => callAdmin('get', {}) });", '}')),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (callAdmin) keeps the wrapper capture']);
    expect(
      await hook(lines('export function useThing() {', '  const fns = useFunctions({ captureErrors: false });', "  return useQuery({ queryKey: k(), queryFn: () => fns.callFunction('get', {}) });", '}')),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (fns.callFunction) keeps the wrapper toast']);
    expect(
      await hook(
        lines(
          'export function useThing(id: string) {',
          '  const { callFunction } = useFunctions();',
          '  const load = async () => {',
          "    const res = await callFunction('get', { id });",
          '    return res.items;',
          '  };',
          '  return useQuery({ queryKey: k(id), queryFn: load });',
          '}',
        ),
      ),
    ).toHaveLength(2);
    expect(
      await hook(
        lines(
          'export function useThing(size = 100) {',
          '  const { callFunction } = useFunctions({ limitedUseAppCheck: true });',
          '  return useInfiniteQuery<Page, Error, Page, ReturnType<typeof keys.list>, Cursor | null>({',
          "    queryKey: keys.list(size), queryFn: ({ pageParam }) => callFunction<R, Page>('list', { pageParam }),",
          '    initialPageParam: null, getNextPageParam: (last): Cursor | null => last.next,',
          '  });',
          '}',
        ),
      ),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (callFunction) keeps the wrapper toast', 'src/hooks/use-thing.ts:3 useThing (callFunction) keeps the wrapper capture']);
  });

  it('flags a read through a mutation hook, a destructured mutation call, and an invoker', async () => {
    expect(
      await hook(lines('export function useThing(id: string) {', '  const save = useSaveThing({ showErrorToast: false });', '  return useQuery({ queryKey: k(id), queryFn: () => save.mutateAsync({ id }) });', '}')),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (save.mutateAsync) keeps the wrapper toast', 'src/hooks/use-thing.ts:3 useThing (save.mutateAsync) keeps the wrapper capture']);
    expect(
      await hook(lines('export function useThing() {', '  const { mutateAsync: fetchThing } = useSaveThing();', '  return useQuery({ queryKey: k(), queryFn: () => fetchThing({}) });', '}')),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (fetchThing) keeps the wrapper toast', 'src/hooks/use-thing.ts:3 useThing (fetchThing) keeps the wrapper capture']);
    expect(
      await hook(lines('export function useThing() {', '  const archive = useArchiveThing();', '  return useQuery({ queryKey: k(), queryFn: () => archive({}) });', '}')),
    ).toEqual(['src/hooks/use-thing.ts:3 useThing (archive) keeps the wrapper toast', 'src/hooks/use-thing.ts:3 useThing (archive) keeps the wrapper capture']);
  });

  it('flags a callable read in a component or a page, even through a reader', async () => {
    const component = lines(
      'const Redirector = () => {',
      '  const { callFunction } = useFunctions({ showErrorToast: false, captureErrors: false });',
      "  const { data } = useQuery<string, Error>({ queryKey: k(), queryFn: () => callFunction('track', {}) });",
      '  return null;',
      '};',
    );
    const page = lines('export default function Page() {', '  const read = useGetThing();', '  const q = useQuery({ queryKey: k(), queryFn: () => read({}) });', '  return null;', '}');
    expect(await findingsOf(callableReadGuard, facts, { ...base, 'src/components/redirector.tsx': component, 'src/app/page.tsx': page })).toEqual([
      'src/app/page.tsx:3 Page (read) is a callable read outside src/hooks',
      'src/components/redirector.tsx:3 (module scope) (callFunction) is a callable read outside src/hooks',
    ]);
  });

  it("flags a read-failure surface that is not handed a callable read's error", async () => {
    const view = lines(
      'export function View({ id }: { id: string }) {',
      '  const { data, isError, refetch } = useAnchorRead(id);',
      '  if (isError) return <LoadErrorState thing="x" onRetry={() => void refetch()} />;',
      '  return null;',
      '}',
    );
    expect(await findingsOf(callableReadGuard, facts, { ...base, 'src/components/view.tsx': view })).toEqual([
      "src/components/view.tsx:3 LoadErrorState renders isError's failure without its error",
    ]);
  });

  it('flags an anchor read the detector no longer finds, a factory that builds nothing, and a missing factory module', async () => {
    const files = { ...base, 'src/hooks/use-anchor.ts': 'export function useAnchorRead() { return null; }', 'src/lib/callables.ts': 'export const useGetThing = createReader("x");' };
    expect(await findingsOf(callableReadGuard, facts, files)).toEqual([
      'src/lib/callables.ts stale factory: createHook builds no exported hook',
      'src/lib/callables.ts stale factory: createInvoker builds no exported hook',
      '(anchorReads) no callable-backed read found in useAnchorRead — the detector no longer recognizes it, or the anchor is stale',
    ]);
    const { ['src/lib/callables.ts']: _gone, ...noModule } = base;
    expect(await findingsOf(callableReadGuard, facts, noModule)).toEqual(['src/lib/callables.ts the callable factory module no longer exists']);
  });

  it('refuses an app with no way to reach a callable, a factory with no kind, and a missing surface or anchor', () => {
    expect(
      callableReadGuard.factProblems({ ...facts, wrappers: [], factoryModules: [], readFailureSurface: { component: 'L', errorProp: '' }, anchorReads: [] }),
    ).toEqual(['the app declares no way to reach a callable (no wrapper and no factory module)', 'readFailureSurface.errorProp is missing', 'anchorReads is empty']);
    expect(
      callableReadGuard.factProblems({ ...facts, factoryModules: [{ module: 'm.ts', factories: [{ name: 'f', kind: 'other' as never }] }] }),
    ).toEqual(['factory f has no kind (reader, mutation, or invoker)']);
    expect(callableReadGuard.factProblems({ ...facts, wrappers: [{ hook: 'useF', invokeMember: '', toastOption: 't', captureOption: 'c' }] })).toEqual([
      'wrappers[0].invokeMember is missing',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('one surface per callable rejection', () => {
  const facts: DoubleSurfaceFacts = {
    wrapper: { hook: 'useFunctions', invokeMember: 'callFunction', toastOption: 'showErrorToast', answerOption: 'isAnswerSurfacedByCaller' },
    toastCall: 'toast',
    destructiveVariants: ['destructive', 'error'],
    nonCallableLegGuards: ['isCallableRejection'],
    appImportPrefixes: ['@/'],
    anchorHooks: ['useThing'],
  };
  const base = {
    'src/hooks/use-thing.ts': lines(
      'export function useThing() {',
      '  const { callFunction } = useFunctions();',
      "  return useMutation({ mutationFn: (v: V) => callFunction('doThing', v) });",
      '}',
      'export function useQuiet() {',
      '  const { callFunction } = useFunctions({ showErrorToast: false });',
      "  return useMutation({ mutationFn: (v: V) => callFunction('quiet', v) });",
      '}',
    ),
  };
  const view = (body: string) => findingsOf(doubleSurfaceGuard, facts, { ...base, 'src/components/card.tsx': body });

  it('passes a wrapper-owned surface, a gated local toast, a success toast, an unrelated toast, and an opted-out hook', async () => {
    const card = lines(
      "import { useThing, useQuiet } from '@/hooks/use-thing';",
      'function Card() {',
      '  const thing = useThing();',
      '  const quiet = useQuiet();',
      '  const run = async () => {',
      '    try { await thing.mutateAsync({ id: 1 }); } catch { } finally { setBusy(false); }',
      '  };',
      '  const copy = () => { try { navigator.clipboard.writeText("x"); } catch { toast({ title: "Copy failed" }); } };',
      "  quiet.mutate({}, { onError: () => toast({ title: 'Failed', variant: 'destructive' }) });",
      '  thing.mutate({}, { onSuccess: () => toast({ title: "Saved" }), onError: (e) => { if (!isCallableRejection(e)) toast({ title: "Offline" }); } });',
      '}',
    );
    expect(await view(card)).toEqual([]);
  });

  it('flags a hook that keeps the wrapper toast and toasts again in its onError', async () => {
    const hooks = lines(
      'export function useThing() {',
      '  const { callFunction } = useFunctions({ limitedUseAppCheck: true });',
      '  return useMutation({',
      "    mutationFn: () => callFunction('x', {}),",
      "    onError: () => toast({ title: 'Failed', variant: 'destructive' }),",
      '  });',
      '}',
    );
    expect(await findingsOf(doubleSurfaceGuard, facts, { 'src/hooks/use-thing.ts': hooks })).toEqual([
      'src/hooks/use-thing.ts:5 useThing keeps the wrapper toast and toasts the failure again in onError',
    ]);
  });

  it("flags a catch toast beside a toasting wrapper, unless it is gated on the wrapper's caller-answer predicate", async () => {
    const hooks = lines(
      'export function useThing() {',
      '  const { callFunction } = useFunctions({ isAnswerSurfacedByCaller: isBusy });',
      '  const go = async () => {',
      "    try { await callFunction('x', {}); } catch (e) { if (isBusy(e)) toast({ title: 'Busy' }); }",
      "    try { await callFunction('y', {}); } catch { toast({ title: 'No tasks' }); }",
      '  };',
      '  return go;',
      '}',
    );
    expect(await findingsOf(doubleSurfaceGuard, facts, { 'src/hooks/use-thing.ts': hooks })).toEqual([
      'src/hooks/use-thing.ts:5 useThing keeps the wrapper toast and toasts the failure again in a catch',
    ]);
  });

  it('flags a call site that toasts again in onError, in a catch, and through a destructured mutate', async () => {
    expect(
      await view(
        lines(
          "import { useThing } from '@/hooks/use-thing';",
          'function Card() {',
          '  const refetch = useThing();',
          "  return <B onClick={() => refetch.mutate({}, { onError: () => toast({ title: 'Failed', variant: 'destructive' }) })} />;",
          '}',
        ),
      ),
    ).toEqual(['src/components/card.tsx:4 refetch (useThing, src/hooks/use-thing.ts) toasts again in its onError']);
    expect(
      await view(
        lines(
          "import { useThing } from '../hooks/use-thing';",
          'function Card() {',
          '  const thing = useThing();',
          '  const run = async () => {',
          "    try { await thing.mutateAsync({}); } catch { toast({ title: 'Checkout failed' }); }",
          '  };',
          '}',
        ),
      ),
    ).toEqual(['src/components/card.tsx:5 thing (useThing, src/hooks/use-thing.ts) toasts again in a catch']);
    expect(
      await view(
        lines(
          "import { useThing } from '@/hooks/use-thing';",
          'function Card() {',
          '  const { mutate: doThing } = useThing();',
          "  return <B onClick={() => doThing({}, { onError: () => toast({ title: 'Failed' }) })} />;",
          '}',
        ),
      ),
    ).toEqual(['src/components/card.tsx:4 doThing (useThing, src/hooks/use-thing.ts) toasts again in its onError']);
  });

  it('flags an anchor hook the pairing no longer sees keeping the wrapper toast', async () => {
    expect(await findingsOf(doubleSurfaceGuard, { ...facts, anchorHooks: ['useQuiet'] }, base)).toEqual([
      '(anchorHooks) useQuiet is not found keeping the wrapper toast — the pairing no longer sees it, or the anchor is stale',
    ]);
  });

  it('refuses a wrapper with no answer option and no anchors', () => {
    expect(doubleSurfaceGuard.factProblems({ ...facts, wrapper: { ...facts.wrapper, answerOption: '' }, anchorHooks: [] })).toEqual([
      'wrapper.answerOption is missing',
      'anchorHooks is empty',
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('no rendered error internals', () => {
  const facts = { renderRoots: ['src/components'], captureCalls: ['captureException'], allowlist: [] };

  it('passes fixed copy, logging and capture, a toast description, and form field errors', async () => {
    const ok = lines(
      '<AlertTitle>Could not load auditions</AlertTitle>',
      "console.error('read failed', error.message);",
      'captureException(error, { extra: { message: error.message } });',
      "toast({ title: 'Could not restart', description: e.message });",
      '<p>{errors.title.message}</p>',
    );
    expect(await findingsOf(errorInternalsGuard, facts, { 'src/components/ok.tsx': ok, 'src/lib/outside.tsx': '<p>{error.message}</p>' })).toEqual([]);
  });

  it('flags a message in JSX, a template hole, an assertion, a stringified error, and a prop', async () => {
    const bad = lines(
      '<p>Failed: {error.message}</p>',
      '<span>{error ? `: ${error.message}` : "."}</span>',
      '<p>{(record.error as Error).message}</p>',
      '<p>{String(err)}</p>',
      '<p>{craftSkillsError.message}</p>',
      'error={error?.message || null}',
    );
    expect(await findingsOf(errorInternalsGuard, facts, { 'src/components/bad.tsx': bad })).toEqual([
      'src/components/bad.tsx:1 not on the reviewed list: error.message',
      'src/components/bad.tsx:2 not on the reviewed list: error.message',
      'src/components/bad.tsx:3 not on the reviewed list: as Error).message',
      'src/components/bad.tsx:4 not on the reviewed list: String(err)',
      'src/components/bad.tsx:5 not on the reviewed list: craftSkillsError.message',
      'src/components/bad.tsx:6 not on the reviewed list: error?.message',
    ]);
  });

  it('proves its samples', () => samplesProve(errorInternalsGuard, facts));

  it('refuses no render roots', () => {
    expect(errorInternalsGuard.factProblems({ ...facts, renderRoots: [] })).toEqual(['renderRoots is empty']);
  });
});
