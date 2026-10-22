import { afterEach, describe, expect, it } from 'vitest';
import {
  counterDecrementGuard,
  randomUuidGuard,
  timestampNowGuard,
  transactionReadGuard,
} from '../../src/modules/firestore/server-guards.js';
import { checkSamples } from '../../src/node/suite/run.js';
import type { Guard } from '../../src/guard.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

async function run(guard: Guard, files: Record<string, string>, { scripts = false } = {}) {
  repo = tempRepo({
    'src/anchor.ts': 'export {};',
    'functions/src/anchor.ts': 'export {};',
    'scripts/anchor.mjs': 'export {};',
    ...files,
  });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/anchor.ts' },
      functions: { path: 'functions/src', anchor: 'functions/src/anchor.ts' },
      ...(scripts ? { scripts: { path: 'scripts', anchor: 'scripts/anchor.mjs' } } : {}),
    },
  });
  return guard.run(contextOf(reader));
}

const lines = (findings: Array<{ file: string; line?: number }>) =>
  findings.map((f) => `${f.file}:${f.line}`);

describe('a transaction callback reads only through its transaction', () => {
  const [guard] = transactionReadGuard.build({});

  it('FLAGS a stray document read, query read, and getAll inside the callback', async () => {
    const findings = await run(guard, {
      'functions/src/tx.ts': [
        'db.runTransaction(async (tx) => { const s = await ref.get(); tx.set(ref, {}); });',
        "db.runTransaction(async (tx) => {\n  const q = await col.where('a', '==', 1).get();\n});",
        'db.runTransaction(async function (t) { const [a, b] = await db.getAll(r1, r2); });',
      ].join('\n'),
    });
    expect(lines(findings)).toEqual([
      'functions/src/tx.ts:1',
      'functions/src/tx.ts:3',
      'functions/src/tx.ts:5',
    ]);
  });

  it('PASSES transactional reads, a non-Firestore get, a read before the transaction, and test code', async () => {
    expect(
      await run(guard, {
        'functions/src/ok.ts': [
          'db.runTransaction(async (tx) => { const s = await tx.get(ref); const q = await tx.get(query); });',
          'db.runTransaction(async (tx) => { const [a] = await tx.getAll(r1); });',
          'db.runTransaction(async (tx) => { const v = cache.get(key); });',
          'const s = await ref.get(); await db.runTransaction(async (tx) => { tx.set(ref, {}); });',
        ].join('\n'),
        'functions/src/ok.test.ts': 'db.runTransaction(async (tx) => { await ref.get(); });',
      }),
    ).toEqual([]);
  });
});

describe('no stored count is lowered by a blind decrement', () => {
  const [guard] = counterDecrementGuard.build({});

  it('FLAGS a literal, a variable, and a parenthesized negative amount, in server code and scripts', async () => {
    const findings = await run(
      guard,
      {
        'functions/src/count.ts': [
          '// FieldValue.increment(-1) in a comment is not a hit',
          'tx.update(ref, { likes: FieldValue.increment(-1) });',
          'tx.update(ref, { bytes: FieldValue.increment(-size) });',
          'tx.update(ref, { n: FieldValue.increment(-(a + b)) });',
        ].join('\n'),
        'scripts/repair.mjs': 'batch.update(ref, { n: admin.firestore.FieldValue.increment(-1) });',
      },
      { scripts: true },
    );
    expect(lines(findings)).toEqual([
      'functions/src/count.ts:2',
      'functions/src/count.ts:3',
      'functions/src/count.ts:4',
      'scripts/repair.mjs:1',
    ]);
  });

  it('PASSES an increment and a clamped lowered value', async () => {
    expect(
      await run(guard, {
        'functions/src/ok.ts':
          'tx.update(ref, { votes: FieldValue.increment(1) });\ntx.update(ref, { votes: Math.max(0, current - 1) });',
      }),
    ).toEqual([]);
  });

  it('refuses facts: it takes none', () => {
    expect(counterDecrementGuard.factProblems([] as never)).toEqual([
      'this guard takes no facts: declare it with {}',
    ]);
  });
});

describe('randomUUID appears only at reviewed sites that mint no document id', () => {
  const build = (reviewedSites: Array<{ path: string; why: string }>) =>
    randomUuidGuard.build({ reviewedSites })[0];

  it('proves its matcher on its samples', () => {
    expect(() => checkSamples(build([]))).not.toThrow();
  });

  it('FLAGS an import and a call outside the reviewed sites, PASSES a reviewed site and prose, and FLAGS a stale site', async () => {
    const findings = await run(
      build([
        { path: 'functions/src/request.ts', why: 'an idempotency request id, never a document id' },
        { path: 'functions/src/gone.ts', why: 'no longer used' },
      ]),
      {
        'functions/src/request.ts':
          "import { randomUUID } from 'node:crypto';\nconst requestId = randomUUID();",
        'functions/src/new.ts': 'const id = crypto.randomUUID();',
        'functions/src/prose.ts': '// never a randomUUID for a document id\nexport {};',
        'functions/src/gone.ts': 'export {};',
      },
    );
    expect(findings.map((f) => `${f.file}:${f.line ?? '-'}`)).toEqual([
      'functions/src/new.ts:1',
      'functions/src/gone.ts:-',
    ]);
  });

  it('refuses a missing site list and a site with no why', () => {
    expect(randomUuidGuard.factProblems({} as never)).toEqual([
      'reviewedSites is missing (declare [] when there is none)',
    ]);
    expect(randomUuidGuard.factProblems({ reviewedSites: [{ path: 'a.ts', why: '' }] })).toEqual([
      'reviewedSites entry a.ts carries no why',
    ]);
  });
});

describe('no Firestore Timestamp is minted with Timestamp.now()', () => {
  const [guard] = timestampNowGuard.build({});

  it('FLAGS Timestamp.now() on a bare and a namespaced receiver, in app and server code', async () => {
    const findings = await run(guard, {
      'src/a.ts': "import { Timestamp } from 'firebase/firestore';\nconst at = Timestamp.now();",
      'functions/src/b.ts': 'const at = admin.firestore.Timestamp.now();',
    });
    expect(lines(findings)).toEqual(['functions/src/b.ts:1', 'src/a.ts:2']);
  });

  it('PASSES Date.now(), another now(), and prose', async () => {
    expect(
      await run(guard, {
        'src/ok.ts':
          '// Timestamp.now() is banned\nconst a = Date.now();\nconst b = performance.now();',
      }),
    ).toEqual([]);
  });
});
