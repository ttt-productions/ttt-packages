import { afterEach, describe, expect, it } from 'vitest';
import {
  firestoreClientWritesGuard,
  firestoreRuntimeInUiGuard,
  liveSubscriptionGuard,
} from '../../src/modules/firestore/client-guards.js';
import { checkSamples } from '../../src/node/suite/run.js';
import type { Guard } from '../../src/guard.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';
import { factProblemsOf } from '../helpers/configured.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

async function run(guard: Guard, files: Record<string, string>) {
  repo = tempRepo({ 'src/anchor.ts': 'export {};', ...files });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/anchor.ts' } },
  });
  return guard.run(contextOf(reader));
}

const lines = (findings: Array<{ file: string; line?: number }>) =>
  findings.map((f) => `${f.file}:${f.line ?? '-'}`);

describe('every live Firestore subscription is on the reviewed list', () => {
  const build = (allowlist: Array<{ path: string; why: string }>) =>
    liveSubscriptionGuard.build({ allowlist })[0];

  it('proves its matcher on its samples', () => {
    expect(() => checkSamples(build([]))).not.toThrow();
  });

  it('FLAGS each spelling of live mode outside the list', async () => {
    const findings = await run(build([]), {
      'src/hooks/a.ts': 'useFirestoreDoc({ docPath, queryKey, subscribe:true });',
      'src/hooks/b.ts': 'useBatchFirestoreDocs({ ids, subscribe: process.env.LIVE === "1" });',
      'src/hooks/c.ts': 'useFirestoreCollection({ collectionPath, subscribe });',
      'src/hooks/d.ts':
        "import { doc, onSnapshot as listen } from 'firebase/firestore';\nconst stop = listen(doc(db, p), render);",
      'src/hooks/e.ts':
        'import * as fs from "firebase/firestore";\nconst stop = fs.onSnapshot(ref, handle);',
      'src/hooks/f.ts':
        "import { onSnapshot } from 'firebase/firestore';\nconst stop = onSnapshot(ref, handle);",
    });
    expect(lines(findings)).toEqual([
      'src/hooks/a.ts:1',
      'src/hooks/b.ts:1',
      'src/hooks/c.ts:1',
      'src/hooks/d.ts:2',
      'src/hooks/e.ts:2',
      'src/hooks/f.ts:2',
    ]);
  });

  it('PASSES a reviewed file, one-shot reads, an opt-out, a store subscriber, a type, and prose; FLAGS a stale entry', async () => {
    const findings = await run(
      build([
        { path: 'src/hooks/me.ts', why: "the signed-in user's own profile" },
        { path: 'src/hooks/was-live.ts', why: 'no longer live' },
      ]),
      {
        'src/hooks/me.ts': 'useFirestoreDoc({ docPath, subscribe: true });',
        'src/hooks/was-live.ts': 'useFirestoreDoc({ docPath, subscribe: false });',
        'src/hooks/ok.ts': [
          "useBatchFirestoreDocs({ db, ids, transport: 'get' });",
          'const unsubscribe = cache.subscribe((e) => handle(e));',
          'interface Options { subscribe: boolean }',
          '/** never subscribe: true here */',
        ].join('\n'),
      },
    );
    expect(lines(findings)).toEqual(['src/hooks/was-live.ts:-']);
  });

  it('PASSES a store source holding read beside subscribe, and still FLAGS live mode beside other keys', async () => {
    const findings = await run(build([]), {
      'src/app/session.tsx': [
        'const LIVE_SESSION: LiveSessionSource = { read: liveUid, subscribe: subscribeSession };',
        'const inline = { read, subscribe };',
        "const quoted = { 'read': liveUid, 'subscribe': feed };",
      ].join('\n'),
      'src/hooks/live.ts': 'useFirestoreDoc({ docPath, readOnly: true, subscribe: true });',
    });
    expect(lines(findings)).toEqual(['src/hooks/live.ts:1']);
  });

  it('reads no test code', async () => {
    expect(
      await run(build([]), { 'src/hooks/a.test.ts': 'useFirestoreDoc({ subscribe: true });' }),
    ).toEqual([]);
  });

  it('refuses a missing list and an entry with no why', () => {
    expect(factProblemsOf(liveSubscriptionGuard, {})).toEqual([
      'allowlist is missing (declare [] when there is none)',
    ]);
    expect(liveSubscriptionGuard.factProblems({ allowlist: [{ path: 'a.ts', why: ' ' }] })).toEqual(
      ['allowlist entry a.ts carries no why'],
    );
  });
});

describe('no component or route imports the Firestore runtime', () => {
  const build = (sanctioned: Array<{ path: string; why: string }>) =>
    firestoreRuntimeInUiGuard.build({ uiFolders: ['src/components', 'src/app'], sanctioned })[0];

  it('proves its matcher on its samples', () => {
    expect(() => checkSamples(build([]))).not.toThrow();
  });

  it('FLAGS a runtime import, a multiline import, a subpath, a re-export, and a dynamic import in a component or route', async () => {
    const findings = await run(build([]), {
      'src/components/probe.tsx': "import { doc, getDoc } from 'firebase/firestore';",
      'src/app/probe/page.tsx': 'import {\n  updateDoc,\n} from "firebase/firestore";',
      'src/components/lite.tsx': "import { getDoc } from 'firebase/firestore/lite';",
      'src/components/again.ts': "export { doc } from 'firebase/firestore';",
      'src/app/lazy.tsx': "const fs = await import('firebase/firestore');",
    });
    expect(lines(findings)).toEqual([
      'src/app/lazy.tsx:1',
      'src/app/probe/page.tsx:1',
      'src/components/again.ts:1',
      'src/components/lite.tsx:1',
      'src/components/probe.tsx:1',
    ]);
  });

  it('PASSES a type import, an inline type import, a hook, and a sanctioned provider; FLAGS a stale provider', async () => {
    const findings = await run(
      build([
        { path: 'src/components/config-provider.tsx', why: 'the one live config subscription' },
        { path: 'src/components/old-provider.tsx', why: 'moved to a hook' },
      ]),
      {
        'src/components/typed.tsx': "import type { Timestamp } from 'firebase/firestore';",
        'src/components/inline-typed.tsx': "import { type Timestamp } from 'firebase/firestore';",
        'src/hooks/use-probe.ts': "import { where } from 'firebase/firestore';",
        'src/components/config-provider.tsx':
          "import { doc, onSnapshot } from 'firebase/firestore';",
        'src/components/old-provider.tsx': 'export {};',
      },
    );
    expect(lines(findings)).toEqual(['src/components/old-provider.tsx:-']);
  });

  it('refuses missing UI folders and a sanctioned entry with no why', () => {
    expect(
      factProblemsOf(firestoreRuntimeInUiGuard, { sanctioned: [{ path: 'a.tsx', why: '' }] }),
    ).toEqual(['uiFolders is missing', 'sanctioned entry a.tsx carries no why']);
  });
});

describe('the client never writes Firestore', () => {
  const build = (sanctioned: Array<{ path: string; why: string }>) =>
    firestoreClientWritesGuard.build({ sanctioned })[0];

  it('proves its matcher on its samples', () => {
    expect(() => checkSamples(build([]))).not.toThrow();
  });

  it('FLAGS each write function imported at runtime, renamed or not, re-exported, or called through a namespace', async () => {
    const findings = await run(build([]), {
      'src/hooks/a.ts': "import { doc, setDoc } from 'firebase/firestore';",
      'src/hooks/b.ts': 'import {\n  writeBatch as batchOf,\n} from "firebase/firestore";',
      'src/lib/c.ts':
        "import * as fs from 'firebase/firestore';\nexport const save = () => fs.addDoc(ref, row);",
      'src/lib/d.ts': "export { deleteDoc } from 'firebase/firestore';",
      'src/lib/e.ts': "import { runTransaction, updateDoc } from 'firebase/firestore/lite';",
    });
    expect(lines(findings)).toEqual([
      'src/hooks/a.ts:1',
      'src/hooks/b.ts:1',
      'src/lib/c.ts:2',
      'src/lib/d.ts:1',
      'src/lib/e.ts:1',
      'src/lib/e.ts:1',
    ]);
  });

  it('PASSES reads, type imports, and a sanctioned writer; FLAGS a stale sanctioned entry', async () => {
    const findings = await run(
      build([
        { path: 'src/lib/offline-queue.ts', why: 'the one sanctioned client writer' },
        { path: 'src/lib/old-writer.ts', why: 'moved to a callable' },
      ]),
      {
        'src/hooks/reads.ts': "import { doc, getDoc, onSnapshot } from 'firebase/firestore';",
        'src/hooks/typed.ts': "import { type WriteBatch } from 'firebase/firestore';",
        'src/hooks/type-only.ts': "import type { Transaction } from 'firebase/firestore';",
        'src/lib/offline-queue.ts': "import { setDoc } from 'firebase/firestore';",
        'src/lib/old-writer.ts': 'export {};',
      },
    );
    expect(lines(findings)).toEqual(['src/lib/old-writer.ts:-']);
  });

  it('refuses a sanctioned entry with no why', () => {
    expect(
      factProblemsOf(firestoreClientWritesGuard, { sanctioned: [{ path: 'a.ts', why: '' }] }),
    ).toEqual(['sanctioned entry a.ts carries no why']);
  });
});
