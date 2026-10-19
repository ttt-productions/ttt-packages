// The failure-handling guards: no swallowed read or write, every post-commit effect captures, and a
// scheduled handler isolates its passes.

import { afterEach, describe, expect, it } from 'vitest';
import {
  postCommitCaptureGuard,
  scheduledPassGuard,
  swallowedReadWriteGuard,
  type PostCommitCaptureFacts,
  type SwallowedReadWriteFacts,
} from '../../src/modules/backend/failure-handling.js';
import { backendRepo, type BackendRepo } from './repo.js';

let repo: BackendRepo | undefined;
afterEach(() => repo?.remove());

describe('no swallowed read or write', () => {
  const facts: SwallowedReadWriteFacts = {
    captureCalls: ['captureException', 'captureMessage'],
    failureExits: ['exitCallableCatch'],
    notReadOrWrite: [
      {
        file: 'functions/src/work.ts',
        pattern: /^rm\(/,
        why: 'a scratch file delete changes no record',
      },
      {
        file: 'functions/src/work.ts',
        pattern: /^res\.(json|text)\(\)$/,
        why: 'an HTTP body read for an error message',
      },
    ],
    catchSites: [
      {
        file: 'functions/src/init.ts',
        receiver: 'initMonitoring(',
        why: "monitoring's own init failure cannot be captured by monitoring",
      },
    ],
    tryCatchSites: [
      {
        file: 'functions/src/lease.ts',
        function: 'leaseStillHeld',
        why: 'a failed lease read answers not held (fail closed)',
      },
    ],
  };

  it('FLAGS a .catch that falls back or only logs and a try/catch that only logs; PASSES capture, rethrow, an awaited record, an exit, the reviewed shapes and sites', async () => {
    repo = backendRepo({
      'functions/src/work.ts': [
        'async function readIt() {',
        "  try { await ref.get(); } catch (e) { logger.warn('x', e); }",
        '}',
        'async function f() { const s = await ref.get().catch(() => null); }',
        "async function g() { await ref.update(p).catch((e) => logger.warn('x', e)); }",
        'async function h() { await ref.get().catch((e) => { captureException(e); return null; }); }',
        'async function i() { await ref.set(d).catch((e) => { throw new Wrapped(e); }); }',
        'async function j() { await rm(tmp, { force: true }).catch(() => undefined); const b = await res.json().catch(() => null); }',
        'async function a() { try { await ref.get(); } catch (e) { captureException(e); } }',
        'async function b() { try { await ref.set(d); } catch (e) { throw e; } }',
        'async function c() { try { await ref.update(p); } catch (e) { await recordFailure(e); } }',
        'async function d() { try { compute(); } catch { return 0; } }',
        "async function k() { try { await tx.commit(); } catch (e) { exitCallableCatch('k', e, 'x'); } }",
      ].join('\n'),
      'functions/src/init.ts': 'initMonitoring(opts).catch((err) => logger.error(err));',
      'functions/src/lease.ts':
        'async function leaseStillHeld() { try { return (await ref.get()).exists; } catch { return false; } }',
      'functions/src/work.test.ts': 'await ref.get().catch(() => null);',
    });
    const [guard] = swallowedReadWriteGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/work.ts',
        line: 4,
        detail: '.catch on ref.get() neither rethrows nor captures',
      },
      {
        file: 'functions/src/work.ts',
        line: 5,
        detail: '.catch on ref.update(p) neither rethrows nor captures',
      },
      {
        file: 'functions/src/work.ts',
        line: 2,
        detail:
          'try/catch around a read or write in readIt neither rethrows, captures, nor records the failure',
      },
    ]);
  });

  it('FLAGS a reviewed shape caught in a file it is not bound to', async () => {
    repo = backendRepo({
      'functions/src/work.ts':
        'async function j() { await rm(tmp, { force: true }).catch(() => undefined); const b = await res.json().catch(() => null); }',
      'functions/src/other.ts': 'async function m() { await rm(record).catch(() => undefined); }',
      'functions/src/init.ts': 'initMonitoring(opts).catch((err) => logger.error(err));',
      'functions/src/lease.ts':
        'async function leaseStillHeld() { try { return (await ref.get()).exists; } catch { return false; } }',
    });
    const [guard] = swallowedReadWriteGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/other.ts',
        line: 1,
        detail: '.catch on rm(record) neither rethrows nor captures',
      },
    ]);
  });

  it('FLAGS every reviewed shape and site that matches nothing', async () => {
    repo = backendRepo({
      'functions/src/init.ts': 'initMonitoring(opts).catch((err) => captureException(err));',
      'functions/src/lease.ts':
        'async function leaseStillHeld() { try { return (await ref.get()).exists; } catch (e) { throw e; } }',
    });
    const [guard] = swallowedReadWriteGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/work.ts',
        detail: 'stale shape /^rm\\(/: no caught expression in this file matches it',
      },
      {
        file: 'functions/src/work.ts',
        detail:
          'stale shape /^res\\.(json|text)\\(\\)$/: no caught expression in this file matches it',
      },
      {
        file: 'functions/src/init.ts',
        detail: 'stale catch site: no swallowing .catch on initMonitoring(',
      },
      {
        file: 'functions/src/lease.ts',
        detail: 'stale try/catch site: leaseStillHeld keeps no failure',
      },
    ]);
  });

  it('refuses a try/catch site with no function, a shape that is not a pattern, and a shape bound to no file', () => {
    expect(
      swallowedReadWriteGuard.factProblems({
        ...facts,
        notReadOrWrite: [
          { pattern: '^rm' as never, why: 'x' } as never,
          { file: '', pattern: /^rm/, why: 'x' },
        ],
        tryCatchSites: [{ file: 'functions/src/lease.ts', function: '', why: 'x' }],
      }),
    ).toEqual([
      'an entry of notReadOrWrite names no file',
      'an entry of notReadOrWrite names no file',
      'tryCatchSites entry functions/src/lease.ts names no function',
    ]);
  });
});

describe('every post-commit side effect captures its failure', () => {
  const MARK = '// Post-commit side effect (non-blocking).';
  const facts: PostCommitCaptureFacts = {
    marker: 'Post-commit side effect (non-blocking)',
    captureCalls: ['captureException', 'captureMessage'],
    helpers: [
      {
        name: 'drainNow',
        file: 'functions/src/drain.ts',
        why: 'one immediate drain; the scheduled drain owns completion',
      },
      {
        name: 'drainAll',
        file: 'functions/src/drain.ts',
        why: 'delegates to drainNow',
        delegates: true,
      },
    ],
  };
  const cleanDrain = [
    'export async function drainNow(ids: string[]) { for (const id of ids) { try { await x(id); } catch (e) { captureException(e); } } }',
    'export async function drainAll() { const t = Date.now(); captureMessage("x"); await drainNow([]); }',
  ].join('\n');

  it('FLAGS a marked catch that only logs, one that rethrows, and an unreviewed helper; PASSES a capture, a reviewed helper, and a marked function', async () => {
    repo = backendRepo({
      'functions/src/drain.ts': cleanDrain,
      'functions/src/work.ts': [
        MARK,
        'try { await sideEffect(); } catch (err) { logger.warn("failed", err); }',
        MARK,
        'try { await sideEffect(); } catch (err) { captureException(err); throw err; }',
        MARK,
        'await somethingBestEffort(id);',
        MARK,
        'if (id) await drainNow([id]);',
        '/**',
        ' * Post-commit side effect (non-blocking)',
        ' */',
        'async function alarm() { try { await send(); } catch (e) { captureMessage("x"); } }',
      ].join('\n'),
    });
    const [guard] = postCommitCaptureGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/work.ts', line: 2, detail: 'catch at line 2 does not capture' },
      { file: 'functions/src/work.ts', line: 4, detail: 'catch at line 4 throws' },
      { file: 'functions/src/work.ts', line: 6, detail: 'nothing in it captures' },
    ]);
  });

  it('FLAGS a leaf helper that works before its try, a delegating helper that does its own work, and helpers that are gone', async () => {
    repo = backendRepo({
      'functions/src/drain.ts': [
        'export async function drainNow() { await risky(); try { await x(); } catch (e) { captureException(e); } }',
        'export async function drainAll() { await risky(); await drainNow(); }',
      ].join('\n'),
      'functions/src/work.ts': `${MARK}\nawait drainNow();`,
    });
    const [guard] = postCommitCaptureGuard.build({
      ...facts,
      helpers: [
        ...facts.helpers,
        { name: 'gone', file: 'functions/src/drain.ts', why: 'x' },
        { name: 'elsewhere', file: 'functions/src/nope.ts', why: 'x' },
      ],
    });
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/drain.ts',
        detail: 'reviewed helper drainNow: a leaf helper awaits before its try',
      },
      {
        file: 'functions/src/drain.ts',
        detail: 'reviewed helper drainAll: a delegating helper calls risky',
      },
      {
        file: 'functions/src/drain.ts',
        detail: 'reviewed helper gone: gone is not declared in it',
      },
      {
        file: 'functions/src/nope.ts',
        detail: 'reviewed helper elsewhere: the file is gone or outside the Functions tree',
      },
    ]);
  });

  it('FLAGS a tree that carries no marker at all', async () => {
    repo = backendRepo({ 'functions/src/drain.ts': cleanDrain });
    const [guard] = postCommitCaptureGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: '(marker)',
        detail:
          'no file carries the marker "Post-commit side effect (non-blocking)", so the guard checks nothing',
      },
    ]);
  });

  it('refuses a helper with no file and a missing marker', () => {
    expect(
      postCommitCaptureGuard.factProblems({
        ...facts,
        marker: '',
        helpers: [{ name: 'h', file: '', why: 'x' }],
      }),
    ).toEqual(['marker is missing', 'helper h names no file']);
  });
});

describe('a scheduled handler isolates its passes', () => {
  const facts = {
    dependentUnits: [
      {
        file: 'functions/src/deadline.ts',
        units: ['runEscalation', 'stampHeartbeat'],
        why: 'the heartbeat records that the pass succeeded',
      },
    ],
  };

  it('FLAGS two awaited passes in one try, a loop and a call included, and a reviewed file gains no cover for a second try; PASSES one unit per try and code outside a schedule', async () => {
    repo = backendRepo({
      'functions/src/deadline.ts': [
        'export const w = onSchedule({}, async () => {',
        '  try { const r = await runEscalation(x); await stampHeartbeat(db, 1); } catch (e) { throw e; }',
        '  try { await sweepA(now); await sweepB(now); } catch (e) { throw e; }',
        '});',
      ].join('\n'),
      'functions/src/jobs.ts': [
        'export const a = onSchedule({}, async () => {',
        '  try {',
        '    for (;;) { const page = await readPage(); if (!page) break; }',
        '    await sweepOthers(now);',
        '  } catch (e) { throw e; }',
        '  try { for (const row of rows) { await settle(row); await record(row); } } catch (e) { throw e; }',
        '  try { await closeExpired(now); } catch (e) { report(e); }',
        '});',
        'async function notScheduled() { try { await a1(); await a2(); } catch (e) { throw e; } }',
      ].join('\n'),
    });
    const [guard] = scheduledPassGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/deadline.ts',
        line: 3,
        detail: 'one try awaits 2 passes: sweepA, sweepB',
      },
      {
        file: 'functions/src/jobs.ts',
        line: 2,
        detail: 'one try awaits 2 passes: loop, sweepOthers',
      },
    ]);
  });

  it('FLAGS a reviewed entry that matches nothing and a tree with no scheduled handler', async () => {
    repo = backendRepo({ 'functions/src/jobs.ts': 'export const x = 1;' });
    const [guard] = scheduledPassGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: '(functions)', detail: 'no onSchedule handler found, so the guard checks nothing' },
      {
        file: 'functions/src/deadline.ts',
        detail:
          'stale dependent-unit entry: functions/src/deadline.ts runEscalation, stampHeartbeat',
      },
    ]);
  });

  it('refuses an entry that names fewer than two units', () => {
    expect(
      scheduledPassGuard.factProblems({
        dependentUnits: [{ file: 'functions/src/a.ts', units: ['one'], why: 'x' }],
      }),
    ).toEqual(['dependentUnits entry functions/src/a.ts names no second unit']);
  });
});
