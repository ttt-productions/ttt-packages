import { describe, expect, it } from 'vitest';
import {
  callableErrorCopyGuard,
  callableNameGuard,
  callableReadGuard,
  callableTransportGuard,
  doubleSurfaceGuard,
  errorInternalsGuard,
  type CallableReadFacts,
  type DoubleSurfaceFacts,
} from '../../src/modules/frontend-actions/callables.js';
import type { CallableDeclarationFacts } from '../../src/modules/frontend-actions/declarations.js';
import { findingsOf, samplesProve } from './run.js';

const lines = (...l: string[]) => l.join('\n');

describe('callable error copy owner', () => {
  const facts = {
    owner: { file: 'src/lib/policy.ts', exportName: 'describeFailure' },
    allowlist: [
      {
        path: 'src/forms/local-check.tsx',
        why: 'a local validation error, not a callable rejection',
      },
    ],
  };
  const base = {
    'src/lib/policy.ts': lines(
      'export function describeFailure(error: unknown) {',
      '  return { description: error.message };',
      '}',
    ),
    'src/forms/local-check.tsx': "toast({ title: 'Invalid', description: error.message });",
    'src/ok.tsx':
      "toast({ title: 'Failed', description: describeFailure(error) });\n<p>{errors.title.message}</p>",
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
    expect(
      await findingsOf(callableErrorCopyGuard, facts, { ...base, 'src/bad.tsx': bad }),
    ).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => `src/bad.tsx:${n} not on the reviewed list: raw error message`),
    );
  });

  it('flags a reviewed entry that no longer holds the shape', async () => {
    const findings = await findingsOf(callableErrorCopyGuard, facts, {
      ...base,
      'src/forms/local-check.tsx': 'export {};',
    });
    expect(findings).toEqual([
      'src/forms/local-check.tsx stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
    ]);
  });

  it('flags an owner that no longer exports the copy function, and an owner that is gone', async () => {
    expect(
      await findingsOf(callableErrorCopyGuard, facts, {
        ...base,
        'src/lib/policy.ts': 'export const other = 1;',
      }),
    ).toEqual(['src/lib/policy.ts the copy owner no longer exports describeFailure']);
    const { ['src/lib/policy.ts']: _gone, ...withoutOwner } = base;
    expect(await findingsOf(callableErrorCopyGuard, facts, withoutOwner)).toEqual([
      'src/lib/policy.ts the copy owner no longer exists',
    ]);
  });

  it('proves its samples', () => samplesProve(callableErrorCopyGuard, facts));

  it('refuses a missing owner, an empty export name, and an entry with no why', () => {
    expect(callableErrorCopyGuard.factProblems({ allowlist: [] } as never)).toEqual([
      'owner is missing',
    ]);
    expect(
      callableErrorCopyGuard.factProblems({
        owner: { file: 'a.ts', exportName: '' },
        allowlist: [{ path: 'b.ts', why: '' }],
      }),
    ).toEqual(['owner.exportName is missing', 'allowlist entry b.ts carries no why']);
  });
});

describe('callable transport through its owner', () => {
  const facts = {
    transports: [
      {
        module: 'firebase/functions',
        symbols: ['httpsCallable', 'getFunctions'],
        owner: 'src/lib/fb.ts',
      },
      { module: '@kit/helpers', symbols: ['callRemote'], owner: 'src/lib/policy.ts' },
    ],
  };
  const base = {
    'src/lib/fb.ts':
      "import { getFunctions } from 'firebase/functions';\nexport const functions = getFunctions(app);",
    'src/lib/policy.ts':
      "import { callRemote } from '@kit/helpers/client';\nexport const call = (n: string) => callRemote(n);",
    'src/ok.tsx':
      "import { call } from '@/lib/policy';\n// httpsCallable(functions, 'x') in prose\nconst getFunctionsLabel = 'getFunctions';",
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
      'src/lib/fb.ts':
        "import { getFunctions } from 'firebase/functions';\nexport const functions = getFunctions(app);\ncallRemote('x');",
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

  it('flags a member call of a transport symbol, and reports a namespace reach once', async () => {
    const files = {
      ...base,
      'src/f.ts': lines(
        "const call = sdk.httpsCallable(functions, 'go');",
        'const fns2 = loadSdk().getFunctions(app);',
      ),
      'src/g.ts': lines(
        "import * as fns from 'firebase/functions';",
        'const f = fns.getFunctions(app);',
      ),
    };
    expect(await findingsOf(callableTransportGuard, facts, files)).toEqual([
      'src/f.ts:1 outside its owner src/lib/fb.ts: calls httpsCallable(',
      'src/f.ts:2 outside its owner src/lib/fb.ts: calls getFunctions(',
      'src/g.ts:2 outside its owner src/lib/fb.ts: reaches fns.getFunctions',
    ]);
  });

  it('flags an owner that no longer names its transport, and one that is gone', async () => {
    const { ['src/lib/policy.ts']: _gone, ...rest } = base;
    expect(
      await findingsOf(callableTransportGuard, facts, { ...rest, 'src/lib/fb.ts': 'export {};' }),
    ).toEqual([
      'src/lib/fb.ts stale owner: it no longer names any of httpsCallable, getFunctions',
      'src/lib/policy.ts the transport owner no longer exists',
    ]);
  });

  it('a transport with no owner is named by no app file', async () => {
    const banned = { transports: [{ module: 'firebase/functions', symbols: ['httpsCallable'] }] };
    expect(
      await findingsOf(callableTransportGuard, banned, {
        'src/ok.tsx': "import { call } from '@/lib/policy';",
      }),
    ).toEqual([]);
    expect(
      await findingsOf(callableTransportGuard, banned, {
        'src/lib/fb.ts': "import { httpsCallable } from 'firebase/functions';",
      }),
    ).toEqual([
      'src/lib/fb.ts:1 no app file may name it: imports httpsCallable from firebase/functions',
    ]);
  });

  it('refuses no transports, and a transport with an empty owner or no symbols', () => {
    expect(callableTransportGuard.factProblems({ transports: [] })).toEqual([
      'transports is missing or empty',
    ]);
    expect(
      callableTransportGuard.factProblems({
        transports: [{ module: 'm', symbols: [], owner: '' }],
      }),
    ).toEqual(["transport m's owner is missing", "transport m's symbols is empty"]);
  });
});

const declarations: CallableDeclarationFacts = {
  modules: ['src/lib/remote.ts'],
  factories: {
    action: 'defineAction',
    reader: 'defineReader',
    invoker: 'defineInvoker',
    resumable: 'defineResumable',
  },
};
const DECLARATIONS = lines(
  'const { defineAction, defineReader, defineInvoker, defineResumable } = makeRemote(POLICY);',
  'export const useGetThing = defineReader<In, Out>("getThing");',
  'export const useSaveThing =',
  '  defineAction<In, Out>("saveThing", { limitedUseAppCheck: true });',
  "export const useArchiveThing = defineInvoker<In, Out>('archiveThing');",
  'export const usePurgeThings = defineResumable<In, Out>("purgeThings", mergePages);',
);

describe("a callable's name is written only in its declaration", () => {
  const facts = {
    declarations,
    allowlist: [{ path: 'src/lib/labels.ts', why: 'an audit label that shares the word' }],
  };
  const base = {
    'src/lib/remote.ts': DECLARATIONS,
    'src/lib/labels.ts': "export const AUDIT = { saveThing: 'saveThing' };",
    'src/components/card.tsx':
      "const save = useSaveThing();\nconst label = 'save thing';\nconst key = ['things', id];",
  };
  const run = (files: Record<string, string>, f = facts) =>
    findingsOf(callableNameGuard, f, { ...base, ...files });

  it('passes the declarations module, a reviewed file, and strings that are no callable name', async () => {
    expect(await run({})).toEqual([]);
  });

  it('flags a callable name written outside its declaration, in a quote, a template, or a property key', async () => {
    expect(
      await run({
        'src/components/raw.tsx': lines(
          "send('getThing', {});",
          'const n = `purgeThings`;',
          "const map = { 'archiveThing': 1 };",
        ),
      }),
    ).toEqual([
      'src/components/raw.tsx:1 names the callable getThing: call its declared hook useGetThing',
      'src/components/raw.tsx:2 names the callable purgeThings: call its declared hook usePurgeThings',
      'src/components/raw.tsx:3 names the callable archiveThing: call its declared hook useArchiveThing',
    ]);
  });

  it('holds a reviewed file to its reviewed count: one more is flagged, one fewer is stale', async () => {
    const counted = {
      declarations,
      allowlist: [
        { path: 'src/lib/labels.ts', why: 'an audit label that shares the word', count: 1 },
      ],
    };
    expect(
      await findingsOf(callableNameGuard, counted, {
        ...base,
        'src/lib/labels.ts':
          "export const AUDIT = { saveThing: 'saveThing', getThing: 'getThing' };",
      }),
    ).toEqual([
      'src/lib/labels.ts:1 more than the 1 reviewed: names the callable getThing: call its declared hook useGetThing',
    ]);
    expect(
      await findingsOf(
        callableNameGuard,
        { ...counted, allowlist: [{ ...counted.allowlist[0], count: 2 }] },
        base,
      ),
    ).toEqual(['src/lib/labels.ts stale count: reviewed 2, found 1']);
  });

  it('flags a reviewed file that no longer holds a callable name', async () => {
    expect(await run({ 'src/lib/labels.ts': 'export const AUDIT = {};' })).toEqual([
      'src/lib/labels.ts stale entry: the file no longer holds a callable name (or is gone)',
    ]);
  });

  it('flags every declaration it cannot read: not an exported hook, built by another function, named through an expression, unreadable options, declared twice', async () => {
    const module = lines(
      DECLARATIONS,
      'const useHidden = defineAction("hiddenThing");',
      'export const useOther = makeOther("otherThing");',
      'export const useByConstant = defineAction(THING_NAME);',
      'export const useOpaque = defineReader("opaqueThing", OPTIONS);',
      'export const useSaveAgain = defineAction("saveThing");',
    );
    expect(await run({ 'src/lib/remote.ts': module })).toEqual([
      'src/lib/remote.ts:7 a defineAction call that is not an exported named hook (`export const useX = defineAction(…)`)',
      'src/lib/remote.ts:8 useOther is built by none of the declared factories (defineAction, defineReader, defineInvoker, defineResumable)',
      'src/lib/remote.ts:9 useByConstant names its callable through an expression this check cannot read: write the name as a string literal',
      "src/lib/remote.ts:10 useOpaque's declaration options are not an object literal, so its App Check posture cannot be read",
      'src/lib/remote.ts:11 useSaveAgain declares saveThing a second time (first as useSaveThing)',
    ]);
  });

  it('flags a declarations module that is gone or declares nothing', async () => {
    expect(
      await run(
        { 'src/lib/remote.ts': 'export const nothing = 1;', 'src/lib/labels.ts': 'export {};' },
        { declarations, allowlist: [] },
      ),
    ).toEqual(['src/lib/remote.ts stale declarations module: it declares no callable']);
    expect(await findingsOf(callableNameGuard, { declarations, allowlist: [] }, {})).toEqual([
      'src/lib/remote.ts the callable declarations module no longer exists',
    ]);
  });

  it('refuses no modules, a kind with no factory, one factory for two kinds, and an entry with no why', () => {
    expect(
      callableNameGuard.factProblems({
        declarations: {
          modules: [],
          factories: { action: 'a', reader: 'a', invoker: 'i', resumable: '' },
        },
        allowlist: [{ path: 'x.ts', why: ' ' }],
      }),
    ).toEqual([
      'declarations.modules is empty',
      'declarations.factories.resumable is missing',
      'declarations.factories names one factory for two kinds',
      'allowlist entry x.ts carries no why',
    ]);
    expect(callableNameGuard.factProblems({ allowlist: [] } as never)).toEqual([
      'declarations is missing',
    ]);
  });
});

describe('callable-backed reads', () => {
  const facts: CallableReadFacts = {
    declarations,
    hooksRoot: 'src/hooks',
    readFailureSurface: { component: 'LoadErrorState', errorProp: 'error' },
    anchorReads: ['useAnchorRead'],
  };
  const base = {
    'src/lib/remote.ts': DECLARATIONS,
    'src/hooks/use-anchor.ts': lines(
      'export function useAnchorRead(id: string) {',
      '  const getThing = useGetThing();',
      '  return useQuery({ queryKey: k(id), queryFn: () => getThing({ id }) });',
      '}',
    ),
  };
  const hook = (body: string) =>
    findingsOf(callableReadGuard, facts, { ...base, 'src/hooks/use-thing.ts': body });

  it('passes a reader read, a reader through a block-local helper, an action in a mutation, and a store read beside an action', async () => {
    const files = {
      ...base,
      'src/hooks/use-helper.ts': lines(
        'export function useHelperRead(id: string) {',
        '  const readThing = useGetThing();',
        '  const load = async () => (await readThing({ id })).items;',
        '  return useInfiniteQuery<Page, Error, Page, ReturnType<typeof keys.list>, Cursor | null>({ queryKey: k(id), queryFn: load });',
        '}',
      ),
      'src/hooks/use-write.ts': lines(
        'export function useManager(id: string) {',
        '  const save = useSaveThing();',
        "  const read = useQuery({ queryKey: k(id), queryFn: () => getDoc(doc(db, 'things', id)) });",
        '  return { read, save };',
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

  it('flags a read through an action, whole or destructured, even with its toast turned off', async () => {
    expect(
      await hook(
        lines(
          'export function useThing(id: string) {',
          '  const save = useSaveThing({ showErrorToast: false });',
          '  return useQuery({ queryKey: k(id), queryFn: () => save.mutateAsync({ id }) });',
          '}',
        ),
      ),
    ).toEqual([
      'src/hooks/use-thing.ts:3 useThing (save) reads through useSaveThing, a declared action: declare the callable as a reader',
    ]);
    expect(
      await hook(
        lines(
          'export function useThing() {',
          '  const { mutateAsync: fetchThing } = useSaveThing();',
          '  return useQuery({ queryKey: k(), queryFn: () => fetchThing({}) });',
          '}',
        ),
      ),
    ).toEqual([
      'src/hooks/use-thing.ts:3 useThing (fetchThing) reads through useSaveThing, a declared action: declare the callable as a reader',
    ]);
  });

  it('flags a read through an invoker and through a resumable action, directly and through a helper', async () => {
    expect(
      await hook(
        lines(
          'export function useThing() {',
          '  const archive = useArchiveThing();',
          '  return useQuery({ queryKey: k(), queryFn: () => archive({}) });',
          '}',
        ),
      ),
    ).toEqual([
      'src/hooks/use-thing.ts:3 useThing (archive) reads through useArchiveThing, a declared invoker: declare the callable as a reader',
    ]);
    expect(
      await hook(
        lines(
          'export function useThing() {',
          '  const purge = usePurgeThings();',
          '  const load = async () => {',
          '    const res = await purge.mutateAsync({});',
          '    return res.removed;',
          '  };',
          '  return useQuery({ queryKey: k(), queryFn: load });',
          '}',
        ),
      ),
    ).toEqual([
      'src/hooks/use-thing.ts:7 useThing (purge) reads through usePurgeThings, a declared resumable: declare the callable as a reader',
    ]);
  });

  it('flags a callable read in a component or a page, even through a reader', async () => {
    const component = lines(
      'const Redirector = () => {',
      '  const track = useGetThing();',
      '  const { data } = useQuery<string, Error>({ queryKey: k(), queryFn: () => track({}) });',
      '  return null;',
      '};',
    );
    const page = lines(
      'export default function Page() {',
      '  const read = useGetThing();',
      '  const q = useQuery({ queryKey: k(), queryFn: () => read({}) });',
      '  return null;',
      '}',
    );
    expect(
      await findingsOf(callableReadGuard, facts, {
        ...base,
        'src/components/redirector.tsx': component,
        'src/app/page.tsx': page,
      }),
    ).toEqual([
      'src/app/page.tsx:3 Page (read) is a callable read outside src/hooks',
      'src/components/redirector.tsx:3 (module scope) (track) is a callable read outside src/hooks',
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
    expect(
      await findingsOf(callableReadGuard, facts, { ...base, 'src/components/view.tsx': view }),
    ).toEqual([
      "src/components/view.tsx:3 LoadErrorState renders isError's failure without its error",
    ]);
  });

  it('flags an anchor read the detector no longer finds, and declarations it cannot read', async () => {
    expect(
      await findingsOf(callableReadGuard, facts, {
        ...base,
        'src/hooks/use-anchor.ts': 'export function useAnchorRead() { return null; }',
      }),
    ).toEqual([
      '(anchorReads) no callable-backed read found in useAnchorRead — the detector no longer recognizes it, or the anchor is stale',
    ]);
    const { ['src/lib/remote.ts']: _gone, ...noModule } = base;
    expect(await findingsOf(callableReadGuard, facts, noModule)).toEqual([
      'src/lib/remote.ts the callable declarations module no longer exists',
      '(anchorReads) no callable-backed read found in useAnchorRead — the detector no longer recognizes it, or the anchor is stale',
    ]);
  });

  it('refuses missing declarations, a missing surface prop, and no anchors', () => {
    expect(
      callableReadGuard.factProblems({
        ...facts,
        declarations: undefined as never,
        readFailureSurface: { component: 'L', errorProp: '' },
        anchorReads: [],
      }),
    ).toEqual([
      'declarations is missing',
      'readFailureSurface.errorProp is missing',
      'anchorReads is empty',
    ]);
  });
});

describe('one surface per callable rejection', () => {
  const facts: DoubleSurfaceFacts = {
    declarations,
    toastCall: 'toast',
    nonCallableLegGuards: ['isCallableRejection'],
    appImportPrefixes: ['@/'],
  };
  const base = {
    'src/lib/remote.ts': DECLARATIONS,
    'src/hooks/use-flow.ts': lines(
      "import { useSaveThing } from '@/lib/remote';",
      'export function useSaveFlow() {',
      '  const save = useSaveThing();',
      '  return save;',
      '}',
      'export function useQuietFlow() {',
      '  const save = useSaveThing({ showErrorToast: false });',
      '  return save;',
      '}',
    ),
  };
  const view = (body: string) =>
    findingsOf(doubleSurfaceGuard, facts, { ...base, 'src/components/card.tsx': body });

  it('passes the shared toast alone, a toast-off call site that owns the surface, gated local toasts, a success toast, and a reader', async () => {
    const card = lines(
      "import { useQuietFlow } from '@/hooks/use-flow';",
      'function Card() {',
      '  const save = useSaveThing();',
      '  const quiet = useSaveThing({ showErrorToast: false, onError: () => toast({ title: "Not saved" }) });',
      '  const flow = useQuietFlow();',
      '  const busy = useSaveThing({ isAnswerSurfacedByCaller: isBusy });',
      '  const read = useGetThing();',
      '  const run = async () => {',
      '    try { await save.mutateAsync({ id: 1 }); } catch { } finally { setBusy(false); }',
      "    try { await busy.mutateAsync({}); } catch (e) { if (isBusy(e)) toast({ title: 'Busy' }); }",
      "    try { await read({}); } catch { toast({ title: 'Could not load' }); }",
      '  };',
      '  const copy = () => { try { navigator.clipboard.writeText("x"); } catch { toast({ title: "Copy failed" }); } };',
      "  flow.mutate({}, { onError: () => toast({ title: 'Failed' }) });",
      '  save.mutate({}, { onSuccess: () => toast({ title: "Saved" }), onError: (e) => { if (!isCallableRejection(e)) toast({ title: "Offline" }); } });',
      '}',
    );
    expect(await view(card)).toEqual([]);
  });

  it('flags a toast in the onError handed to a declared hook while its toast is on', async () => {
    expect(
      await view(
        lines(
          'function Card() {',
          "  const save = useSaveThing({ onError: () => toast({ title: 'Failed' }) });",
          '}',
        ),
      ),
    ).toEqual([
      'src/components/card.tsx:2 save (useSaveThing, src/lib/remote.ts) toasts again in the onError it hands the hook',
    ]);
  });

  it('flags a toast in a mutate onError, a destructured mutate onError, and a catch around mutateAsync', async () => {
    expect(
      await view(
        lines(
          'function Card() {',
          '  const save = useSaveThing();',
          '  const { mutate: purge } = usePurgeThings();',
          "  const a = () => save.mutate({}, { onError: () => toast({ title: 'Failed' }) });",
          "  const b = () => purge({}, { onError: () => toast({ title: 'Failed' }) });",
          '  const c = async () => {',
          "    try { await save.mutateAsync({}); } catch { toast({ title: 'Checkout failed' }); }",
          '  };',
          '}',
        ),
      ),
    ).toEqual([
      'src/components/card.tsx:4 save (useSaveThing, src/lib/remote.ts) toasts again in its onError',
      'src/components/card.tsx:7 save (useSaveThing, src/lib/remote.ts) toasts again in a catch',
      'src/components/card.tsx:5 purge (usePurgeThings, src/lib/remote.ts) toasts again in its onError',
    ]);
  });

  it('flags an invoker driven by a mutation that toasts its failure again', async () => {
    const hooks = lines(
      'export function useArchiveFlow() {',
      '  const archive = useArchiveThing();',
      "  return useMutation({ mutationFn: (v: V) => archive(v), onError: () => toast({ title: 'Failed', variant: 'destructive' }) });",
      '}',
    );
    expect(
      await findingsOf(doubleSurfaceGuard, facts, { ...base, 'src/hooks/use-archive.ts': hooks }),
    ).toEqual([
      'src/hooks/use-archive.ts:3 archive (useArchiveThing, src/lib/remote.ts) toasts again in the onError of the mutation that calls it',
    ]);
  });

  it("flags an invoker driven by the session mutation owner that toasts its failure again, and passes one that doesn't", async () => {
    const hooks = lines(
      'export function useArchiveFlow() {',
      '  const archive = useArchiveThing();',
      "  return useSessionMutation({ mutationFn: (v: V) => archive(v), onError: () => toast({ title: 'Failed' }) });",
      '}',
      'export function useResetFlow() {',
      '  const archive = useArchiveThing();',
      '  return useSessionMutation({ mutationFn: (v: V) => archive(v), onError: () => reset() });',
      '}',
    );
    expect(
      await findingsOf(doubleSurfaceGuard, facts, { ...base, 'src/hooks/use-archive.ts': hooks }),
    ).toEqual([
      'src/hooks/use-archive.ts:3 archive (useArchiveThing, src/lib/remote.ts) toasts again in the onError of the mutation that calls it',
    ]);
  });

  it('flags a call site that toasts again through an app hook built over a toasting declared hook', async () => {
    expect(
      await view(
        lines(
          "import { useSaveFlow } from '@/hooks/use-flow';",
          'function Card() {',
          '  const flow = useSaveFlow();',
          "  return <B onClick={() => flow.mutate({}, { onError: () => toast({ title: 'Failed' }) })} />;",
          '}',
        ),
      ),
    ).toEqual([
      'src/components/card.tsx:4 flow (useSaveFlow, src/hooks/use-flow.ts) toasts again in its onError',
    ]);
  });

  it('treats call-site options it cannot see as keeping the toast on', async () => {
    expect(
      await view(
        lines(
          'function Card() {',
          '  const save = useSaveThing(importedOptions);',
          "  const a = () => save.mutate({}, { onError: () => toast({ title: 'Failed' }) });",
          '}',
        ),
      ),
    ).toEqual([
      'src/components/card.tsx:3 save (useSaveThing, src/lib/remote.ts) toasts again in its onError',
    ]);
  });

  it('flags declarations it cannot read, and refuses missing declarations and no leg guards', async () => {
    const { ['src/lib/remote.ts']: _gone, ...noModule } = base;
    expect(await findingsOf(doubleSurfaceGuard, facts, noModule)).toEqual([
      'src/lib/remote.ts the callable declarations module no longer exists',
    ]);
    expect(
      doubleSurfaceGuard.factProblems({
        ...facts,
        declarations: undefined as never,
        nonCallableLegGuards: [],
      }),
    ).toEqual(['declarations is missing', 'nonCallableLegGuards is empty']);
  });
});

describe('no rendered error internals', () => {
  const facts = {
    renderRoots: ['src/components'],
    captureCalls: ['captureException'],
    allowlist: [],
  };

  it('passes fixed copy, logging and capture, a toast description, and form field errors', async () => {
    const ok = lines(
      '<AlertTitle>Could not load auditions</AlertTitle>',
      "console.error('read failed', error.message);",
      'captureException(error, { extra: { message: error.message } });',
      "toast({ title: 'Could not restart', description: e.message });",
      '<p>{errors.title.message}</p>',
    );
    expect(
      await findingsOf(errorInternalsGuard, facts, {
        'src/components/ok.tsx': ok,
        'src/lib/outside.tsx': '<p>{error.message}</p>',
      }),
    ).toEqual([]);
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
    expect(await findingsOf(errorInternalsGuard, facts, { 'src/components/bad.tsx': bad })).toEqual(
      [
        'src/components/bad.tsx:1 not on the reviewed list: error.message',
        'src/components/bad.tsx:2 not on the reviewed list: error.message',
        'src/components/bad.tsx:3 not on the reviewed list: as Error).message',
        'src/components/bad.tsx:4 not on the reviewed list: String(err)',
        'src/components/bad.tsx:5 not on the reviewed list: craftSkillsError.message',
        'src/components/bad.tsx:6 not on the reviewed list: error?.message',
      ],
    );
  });

  it('proves its samples', () => samplesProve(errorInternalsGuard, facts));

  it('refuses no render roots', () => {
    expect(errorInternalsGuard.factProblems({ ...facts, renderRoots: [] })).toEqual([
      'renderRoots is empty',
    ]);
  });
});
