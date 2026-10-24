import { afterEach, describe, expect, it } from 'vitest';
import {
  auditPayloadGuard,
  auditWriterGuard,
  failureAuditGuard,
  fireAndForgetGuard,
  refusalAuditGuard,
  type AuditWriterFacts,
  type RefusalAuditFacts,
} from '../../src/modules/backend/audit.js';
import { backendRepo, samplesHold, type BackendRepo } from './repo.js';
import { factProblemsOf } from '../helpers/configured.js';

let repo: BackendRepo | undefined;
afterEach(() => repo?.remove());

const writerFacts = (overrides: Partial<AuditWriterFacts> = {}): AuditWriterFacts => ({
  writer: 'functions/src/audit/write.ts',
  collectionName: 'auditEvents',
  collectionHandles: ['COLLECTIONS.AUDIT_EVENTS', 'PATH_BUILDERS.auditEvent'],
  writerPackages: ['@pkg/audit-core'],
  readers: [{ path: 'functions/src/admin/ops.ts', why: 'counts events; writes nothing' }],
  personActor: {
    constructors: 'functions/src/shared/actor.ts',
    modeField: 'mode',
    modes: ['user', 'adminReview'],
  },
  appServerZone: { folders: ['src/server'], serverModules: ['firebase-admin'] },
  ...overrides,
});

const cleanWriterFiles = {
  'functions/src/audit/write.ts':
    "import { createAuditWriter } from '@pkg/audit-core/server';\nexport const w = () => db.collection(COLLECTIONS.AUDIT_EVENTS);",
  'functions/src/admin/ops.ts':
    "export const q = db.collection(COLLECTIONS.AUDIT_EVENTS).where('t', '==', 1);",
  'functions/src/shared/actor.ts':
    "export const userActor = (uid: string) => ({ mode: 'user', uid });",
  'functions/src/audit/write.test.ts': "db.collection('auditEvents').add({ mode: 'user' });",
  'src/components/browse.tsx':
    "startSearch({ mode: 'user', user });\nconst rows = db.collection(COLLECTIONS.AUDIT_EVENTS);",
  'src/server/health.ts': 'export const ok = true;',
};

describe('one audit writer', () => {
  it('passes the writer, a reviewed reader, the actor constructors, test code, and client code', async () => {
    repo = backendRepo(cleanWriterFiles);
    const guards = auditWriterGuard.build(writerFacts());
    for (const guard of guards) expect(await repo.run(guard)).toEqual([]);
  });

  it('FLAGS every way a second writer names the collection, in Functions, scripts, and app server code; a reader that stops reading is stale', async () => {
    repo = backendRepo({
      ...cleanWriterFiles,
      'functions/src/admin/ops.ts': 'export const n = 1;',
      'functions/src/x/second.ts': [
        "db.collection('auditEvents').add(e);",
        'db.doc(`auditEvents/${id}`).set(e);',
        'db.doc(toPath(PATH_BUILDERS.auditEvent(id))).create(e);',
        "const a = { mode: 'adminReview' as const, uid };",
        "// db.collection('auditEvents') in a comment is never a hit",
        "const label = 'auditEventsCount';",
      ].join('\n'),
      'scripts/backfill.mjs': "import { createAuditWriter } from '@pkg/audit-core/server';",
      'src/server/route.ts': 'db.collection(COLLECTIONS.AUDIT_EVENTS).add(e);',
      'src/lib/admin.ts':
        "import { getFirestore } from 'firebase-admin/firestore';\nconst a = { mode: 'user', uid };",
    });
    const [collection, actors] = auditWriterGuard.build(writerFacts());
    expect(await repo.run(collection!)).toEqual([
      {
        file: 'functions/src/x/second.ts',
        line: 1,
        detail: "not on the reviewed list: 'auditEvents'",
      },
      {
        file: 'functions/src/x/second.ts',
        line: 2,
        detail: 'not on the reviewed list: auditEvents template path',
      },
      {
        file: 'functions/src/x/second.ts',
        line: 3,
        detail: 'not on the reviewed list: PATH_BUILDERS.auditEvent',
      },
      {
        file: 'scripts/backfill.mjs',
        line: 1,
        detail: 'not on the reviewed list: imports @pkg/audit-core/server',
      },
      {
        file: 'src/server/route.ts',
        line: 1,
        detail: 'not on the reviewed list: COLLECTIONS.AUDIT_EVENTS',
      },
      {
        file: 'functions/src/admin/ops.ts',
        detail:
          'stale entry: the file no longer holds the pattern (or is gone, or is outside the scope)',
      },
    ]);
    expect(await repo.run(actors!)).toEqual([
      {
        file: 'functions/src/x/second.ts',
        line: 4,
        detail: "outside its owner: mode: 'adminReview'",
      },
      { file: 'src/lib/admin.ts', line: 2, detail: "outside its owner: mode: 'user'" },
    ]);
  });

  it('FLAGS actor constructors that no longer build a person-actor, and a server folder that is gone', async () => {
    repo = backendRepo({
      ...cleanWriterFiles,
      'functions/src/shared/actor.ts': 'export const none = 1;',
    });
    const [, actors] = auditWriterGuard.build(
      writerFacts({ appServerZone: { folders: ['src/gone'], serverModules: [] } }),
    );
    expect(await repo.run(actors!)).toEqual([
      { file: 'src/gone', detail: 'stale server folder: it no longer exists' },
      {
        file: 'functions/src/shared/actor.ts',
        detail: 'stale owner: the pattern no longer appears in it (or it is outside the scope)',
      },
    ]);
  });

  it('carries samples its matchers prove', () => {
    for (const guard of auditWriterGuard.build(writerFacts()))
      expect(samplesHold(guard)).toBe(true);
  });

  it('refuses facts with a reader without a why, the writer as a reader, an unreadable handle, no modes, or no server zone', () => {
    const facts = writerFacts({
      readers: [{ path: 'functions/src/audit/write.ts', why: ' ' }],
      collectionHandles: ['AUDIT_EVENTS'],
      personActor: { constructors: 'functions/src/shared/actor.ts', modeField: 'mode', modes: [] },
      appServerZone: undefined,
    });
    expect(factProblemsOf(auditWriterGuard, facts)).toEqual([
      'collection handle AUDIT_EVENTS is not OWNER.member',
      'readers entry functions/src/audit/write.ts carries no why',
      'the writer is listed as a reader',
      'personActor.modes is empty',
      'appServerZone is missing (an app with no server code in its app root declares { folders: [], serverModules: [] })',
    ]);
  });
});

describe('no member-written text in an audit payload', () => {
  const facts = {
    entryPoints: ['writeAuditEventAs', 'writeFailureAuditEventAs'],
    payloadKey: 'payload',
    forwardedPayloadKeys: ['auditPayload'],
    operatorCopy: [
      {
        site: 'functions/src/admin/broadcast.ts#title',
        why: 'an operator writes the broadcast title',
      },
    ],
  };

  it('FLAGS member text at any depth, in each entry point and a forwarded payload; PASSES field names, lengths, other payloads, prose, and operator copy', async () => {
    repo = backendRepo({
      'functions/src/a.ts': [
        "writeAuditEventAs(actor, { type: 'x', payload: { projectId, title: input.title } });",
        "writeFailureAuditEventAs(actor, { type: 'x', payload: { folder: { folderName: name } } });",
        'commit({ auditPayload: { displayName: p.displayName } });',
        "writeAuditEventAs(actor, { type: 'x', payload: { changedFields: ['title'], changedFieldLengths: { title: 4 } } });",
        'enqueue({ payload: { projectTitle: t } });',
        '// writeAuditEventAs(actor, { payload: { title } })',
      ].join('\n'),
      'functions/src/admin/broadcast.ts': 'writeAuditEventAs(actor, { payload: { title } });',
    });
    const [guard] = auditPayloadGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/a.ts', line: 1, detail: 'prose-named payload key title' },
      { file: 'functions/src/a.ts', line: 2, detail: 'prose-named payload key folderName' },
      { file: 'functions/src/a.ts', line: 3, detail: 'prose-named payload key displayName' },
    ]);
  });

  it('FLAGS an operator-copy entry whose key no longer occurs', async () => {
    repo = backendRepo({
      'functions/src/admin/broadcast.ts': 'writeAuditEventAs(actor, { payload: { broadcastId } });',
    });
    const [guard] = auditPayloadGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/admin/broadcast.ts#title',
        detail: 'stale operator-copy entry: the key no longer occurs',
      },
    ]);
  });

  it('refuses an operator-copy site that is not file#key', () => {
    expect(
      auditPayloadGuard.factProblems({
        ...facts,
        operatorCopy: [{ site: 'functions/src/a.ts', why: 'x' }],
      }),
    ).toEqual(['operatorCopy site functions/src/a.ts is not file#key']);
  });
});

describe('no handler chained onto a failure-audit entry point', () => {
  const facts = {
    failureEntryPoints: ['writeFailureAuditEventAs', 'writeRequestFailureAuditEvent'],
  };

  it('FLAGS a chained .catch, .then, and .finally, and an aliased import', async () => {
    repo = backendRepo({
      'functions/src/probe.ts': [
        "import { writeFailureAuditEventAs as recordDenial } from '../audit/index.js';",
        'export async function a() {',
        '  await writeFailureAuditEventAs(actor, { type: "x.y" }).catch(() => undefined);',
        '  await writeRequestFailureAuditEvent(request, authError, {',
        '    type: "x.y",',
        '  })',
        '    .then(() => undefined);',
        '  await audit.writeRequestFailureAuditEvent(r, e).finally(done);',
        '}',
      ].join('\n'),
    });
    const [guard] = failureAuditGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/probe.ts',
        line: 1,
        detail: 'imports writeFailureAuditEventAs under another name',
      },
      {
        file: 'functions/src/probe.ts',
        line: 3,
        detail: 'chains .catch onto writeFailureAuditEventAs',
      },
      {
        file: 'functions/src/probe.ts',
        line: 4,
        detail: 'chains .then onto writeRequestFailureAuditEvent',
      },
      {
        file: 'functions/src/probe.ts',
        line: 8,
        detail: 'chains .finally onto writeRequestFailureAuditEvent',
      },
    ]);
  });

  it('PASSES a bare call in a catch clause, its declaration, and prose', async () => {
    repo = backendRepo({
      'functions/src/probe.ts': [
        "import { writeFailureAuditEventAs } from '../audit/index.js';",
        'export async function writeFailureAuditEventAs(actor: unknown) {',
        '  try { await write(actor); } catch (error) { logger.error("failed", error); }',
        '}',
        'export async function b() {',
        '  try { return await work(); } catch (error) {',
        '    // writeFailureAuditEventAs(actor).catch(() => undefined) is never written',
        '    await writeRequestFailureAuditEvent(request, authError, { failureReason: "try { it }" });',
        '    await writeFailureAuditEventAs(actor);',
        '    throw error;',
        '  }',
        '}',
      ].join('\n'),
    });
    const [guard] = failureAuditGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([]);
  });

  it('FLAGS a declared entry point that is called nowhere', async () => {
    repo = backendRepo({
      'functions/src/probe.ts':
        'await writeFailureAuditEventAs(a);\nawait writeRequestFailureAuditEvent(r, e);',
    });
    const [guard] = failureAuditGuard.build({
      failureEntryPoints: [...facts.failureEntryPoints, 'writeGoneAudit'],
    });
    expect(await repo.run(guard!)).toEqual([
      { file: '(failureEntryPoints)', detail: 'writeGoneAudit is called nowhere' },
    ]);
  });

  it('refuses an empty entry-point list', () => {
    expect(failureAuditGuard.factProblems({ failureEntryPoints: [] })).toEqual([
      'failureEntryPoints is empty',
    ]);
  });
});

describe("a refusal's failure event goes through the failure entry points, as the caller", () => {
  const facts: RefusalAuditFacts = {
    plainWriter: 'writeAuditEventAs',
    failureEntryPoints: ['writeFailureAuditEventAs', 'writeRequestFailureAuditEvent'],
    systemActorBuilders: ['systemActor'],
    systemActorMode: { field: 'mode', value: 'system' },
    callableFactories: ['onCall'],
  };
  const cleanFiles = {
    'functions/src/audit/write.ts': [
      'export async function writeAuditEventAs(actor: unknown, details: object) { return commit(actor, details); }',
      'export async function writeFailureAuditEventAs(actor: unknown, details: object) {',
      "  try { await writeAuditEventAs(actor, { ...details, result: 'failure' }); } catch (e) { report(e); }",
      '}',
      'export const writeRequestFailureAuditEvent = async (request: unknown, refusal: unknown, details: object) => {',
      "  await writeAuditEventAs(systemActor('x'), { ...details, result: 'failure' });",
      '};',
    ].join('\n'),
    'functions/src/jobs/sweep.ts':
      "await writeAuditEventAs(systemActor('sweep'), { type: 'a.b' });",
  };

  it('FLAGS a refusal written through the plain writer and a refusal recorded as the system, in a callable module', async () => {
    repo = backendRepo({
      ...cleanFiles,
      'functions/src/safety/command.ts': [
        "const sweeper = systemActor('sweep');",
        'async function recordRefusal(actor: unknown) {',
        "  try { await writeAuditEventAs(actor, { type: 'a.b', result: 'failure' }); } catch { /* lost */ }",
        '}',
        'export const command = onCall(async (request) => {',
        '  try { return await run(request); } catch (error) {',
        "    await writeFailureAuditEventAs(systemActor('refused'), { type: 'a.b' });",
        "    await writeFailureAuditEventAs({ mode: 'system' as const, uid: null }, { type: 'a.b' });",
        "    await writeFailureAuditEventAs(sweeper, { type: 'a.b' });",
        "    await writeAuditEventAs(sweeper, { type: 'a.b', result: 'failure', transaction: tx });",
        '    throw error;',
        '  }',
        '});',
      ].join('\n'),
    });
    const [guard] = refusalAuditGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/safety/command.ts',
        line: 3,
        detail: 'writeAuditEventAs writes a failure event outside a transaction',
      },
      {
        file: 'functions/src/safety/command.ts',
        line: 7,
        detail: 'writeFailureAuditEventAs records a refusal as the system',
      },
      {
        file: 'functions/src/safety/command.ts',
        line: 8,
        detail: 'writeFailureAuditEventAs records a refusal as the system',
      },
      {
        file: 'functions/src/safety/command.ts',
        line: 9,
        detail: 'writeFailureAuditEventAs records a refusal as the system',
      },
      {
        file: 'functions/src/safety/command.ts',
        line: 10,
        detail: 'writeAuditEventAs records a failure as the system',
      },
    ]);
  });

  it('PASSES an in-transaction failure event, the request-bound entry point, the operator as actor, the entry points themselves, and a worker module', async () => {
    repo = backendRepo({
      ...cleanFiles,
      'functions/src/safety/command.ts': [
        'export const command = onCall(async (request) => {',
        '  const actor = await operatorActor(request);',
        '  try { return await run(request); } catch (error) {',
        "    await writeRequestFailureAuditEvent(request, error, { type: 'a.b' });",
        "    await writeFailureAuditEventAs(actor, { type: 'a.b' });",
        '    throw error;',
        '  }',
        '});',
        'export async function step(tx: unknown, actor: unknown) {',
        "  await writeAuditEventAs(actor, { type: 'a.b', result: 'failure', transaction: tx });",
        "  await writeAuditEventAs(systemActor('cleanup'), { type: 'a.b', result: 'success' });",
        "  // writeAuditEventAs(actor, { result: 'failure' }) in a comment is never read",
        '}',
      ].join('\n'),
      'functions/src/chat/drain.ts': [
        'export async function failCommand(actor: unknown) {',
        "  await writeAuditEventAs(actor, { type: 'a.b', result: 'failure', eventId: 'x' });",
        "  await writeFailureAuditEventAs(systemActor('drain'), { type: 'a.b' });",
        '}',
      ].join('\n'),
      'functions/src/safety/command.test.ts': [
        'onCall(handler);',
        "await writeAuditEventAs(actor, { type: 'a.b', result: 'failure' });",
      ].join('\n'),
    });
    const [guard] = refusalAuditGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([]);
  });

  it('FLAGS a declared writer, builder, or factory that is called nowhere', async () => {
    repo = backendRepo(cleanFiles);
    const [guard] = refusalAuditGuard.build({
      ...facts,
      systemActorBuilders: [...facts.systemActorBuilders, 'goneActor'],
    });
    expect(await repo.run(guard!)).toEqual([
      { file: '(refusalAudit)', detail: 'goneActor is called nowhere' },
      { file: '(refusalAudit)', detail: 'onCall is called nowhere' },
    ]);
  });

  it('refuses missing facts and the plain writer listed as a failure entry point', () => {
    expect(
      refusalAuditGuard.factProblems({
        plainWriter: 'writeAuditEventAs',
        failureEntryPoints: ['writeAuditEventAs'],
        systemActorBuilders: [],
        systemActorMode: { field: 'mode', value: '' },
        callableFactories: ['onCall'],
      }),
    ).toEqual([
      'systemActorBuilders is empty',
      'systemActorMode.value is missing',
      'the plain writer is listed as a failure entry point',
    ]);
  });
});

describe('no fire-and-forget work and no swallowed audit write', () => {
  const facts = {
    auditWrites: ['writeAuditEventAs', 'writeAuditEvent'],
    voidSites: [
      {
        path: 'functions/src/child.ts',
        why: 'a child process entry point that awaits all of its work',
      },
    ],
  };

  it('FLAGS every void-ed call and every .catch on an audit write; PASSES awaited writes, a void of a value, a reviewed file, and tests', async () => {
    repo = backendRepo({
      'functions/src/work.ts': [
        'void ref.create(record);',
        'void runSync(input).then(done);',
        "writeAuditEvent({ type: 'x' }).catch(() => undefined);",
        "await writeAuditEventAs(actor, { type: 'x' }).catch(() => undefined);",
        "void writeAuditEventAs(actor, { type: 'x', transaction: txn });",
        "await writeAuditEventAs(actor, { type: 'x' });",
        'void policy;',
      ].join('\n'),
      'functions/src/child.ts': 'void main();',
      'functions/src/work.test.ts': 'void run();',
    });
    const [guard] = fireAndForgetGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      {
        file: 'functions/src/work.ts',
        line: 1,
        detail: 'fire-and-forget: void ref.create(record)',
      },
      {
        file: 'functions/src/work.ts',
        line: 2,
        detail: 'fire-and-forget: void runSync(input).then(done)',
      },
      {
        file: 'functions/src/work.ts',
        line: 5,
        detail: "fire-and-forget: void writeAuditEventAs(actor, { type: 'x', transaction: txn })",
      },
      {
        file: 'functions/src/work.ts',
        line: 3,
        detail: 'writeAuditEvent(…).catch(…) swallows an audit write',
      },
      {
        file: 'functions/src/work.ts',
        line: 4,
        detail: 'writeAuditEventAs(…).catch(…) swallows an audit write',
      },
    ]);
  });

  it('FLAGS a void-ed call behind a non-null assertion', async () => {
    repo = backendRepo({
      'functions/src/child.ts': 'void main();',
      'functions/src/work.ts': [
        'void queue.flush()!;',
        'await writeAuditEventAs(a, d);',
        'await writeAuditEvent(d);',
      ].join('\n'),
    });
    const [guard] = fireAndForgetGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/work.ts', line: 1, detail: 'fire-and-forget: void queue.flush()!' },
    ]);
  });

  it('FLAGS a reviewed void site with no void-ed call left, and an audit write called nowhere', async () => {
    repo = backendRepo({
      'functions/src/child.ts': 'await main();',
      'functions/src/work.ts': 'await writeAuditEventAs(a, d);',
    });
    const [guard] = fireAndForgetGuard.build(facts);
    expect(await repo.run(guard!)).toEqual([
      { file: 'functions/src/child.ts', detail: 'stale void site: the file has no void-ed call' },
      { file: '(auditWrites)', detail: 'writeAuditEvent is called nowhere' },
    ]);
  });

  it('refuses a void site without a why', () => {
    expect(
      fireAndForgetGuard.factProblems({
        auditWrites: [],
        voidSites: [{ path: 'functions/src/child.ts', why: '' }],
      }),
    ).toEqual(['voidSites entry functions/src/child.ts carries no why']);
  });

  it('refuses a void site whose path is not repo-relative or ends in a slash', () => {
    expect(
      fireAndForgetGuard.factProblems({
        auditWrites: [],
        voidSites: [
          { path: 'C:/repo/functions/src/a.ts', why: 'w' },
          { path: 'functions/src/', why: 'w' },
        ],
      }),
    ).toEqual([
      'voidSites entry C:/repo/functions/src/a.ts (C:/repo/functions/src/a.ts) must be repo-relative and forward-slashed',
      'voidSites entry functions/src/ (functions/src/) must not end with a slash',
    ]);
  });
});
