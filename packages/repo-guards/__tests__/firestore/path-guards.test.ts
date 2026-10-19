// The path guards: a typed segment, a hand-assembled path, and a retired segment each fail, on both
// SDKs and in every syntax that builds the same path; the owners' shapes, computed ids, and prose pass.

import { afterEach, describe, expect, it } from 'vitest';
import { literalSegmentGuard, pathAssemblyGuard, retiredSegmentGuard, type PathAssemblyFacts, type RetiredSegmentFacts } from '../../src/modules/firestore/path-guards.js';
import { createRepoReader } from '../../src/node/reader.js';
import type { RepoLayout } from '../../src/node/layout.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const ANCHORS = { 'src/anchor.ts': 'export {};', 'functions/src/anchor.ts': 'export {};' };

function readerOver(files: Record<string, string>, extra: Partial<RepoLayout['roots']> = {}) {
  repo = tempRepo({ ...ANCHORS, ...files });
  return createRepoReader({
    repoRoot: repo.root,
    roots: {
      app: { path: 'src', anchor: 'src/anchor.ts' },
      functions: { path: 'functions/src', anchor: 'functions/src/anchor.ts' },
      ...extra,
    },
  });
}

async function run(guard: { run: (c: ReturnType<typeof contextOf>) => unknown }, files: Record<string, string>, extra?: Partial<RepoLayout['roots']>) {
  const findings = (await guard.run(contextOf(readerOver(files, extra)))) as Array<{ file: string; line?: number; detail: string }>;
  return findings;
}

const at = (findings: Array<{ file: string; line?: number }>) => findings.map((f) => `${f.file}:${f.line}`);

describe('no typed path segment reaches a Firestore accessor', () => {
  const [guard] = literalSegmentGuard.build({});

  it('PASSES the owner shapes, computed ids, a variable id, auto-ids, and prose', async () => {
    const clean = [
      'const jobs = db.collection(COLLECTIONS.JOBS);',
      'const games = db.collectionGroup(COLLECTION_GROUPS.GAMES);',
      'const ref = db.doc(toPath(PATH_BUILDERS.reservation(id)));',
      'const user = usersRef.doc(someId);',
      'const fresh = db.collection(COLLECTIONS.JOBS).doc();',
      'const task = db.collection(COLLECTIONS.TASKS).doc(`${prefix}-${key}`);',
      'const NAME = COLLECTIONS.JOBS;\nconst named = db.collection(NAME);',
      "const hint = 'never write .collection(\\'counted\\')';",
      "// never write groupRef.collection('counted')",
      'const a = doc(db, ...SEGMENTS.league(leagueId));',
      'const b = doc(db, COLLECTIONS.LEAGUES, leagueId, COLLECTIONS.GAMES, gameId);',
      'const c = doc(db, ...SEGMENTS.gameRoster(gameId), userId);',
    ].join('\n');
    expect(await run(guard, { 'src/clean.ts': clean, 'functions/src/clean.ts': clean })).toEqual([]);
  });

  it('FLAGS a literal behind a type assertion', async () => {
    const findings = await run(guard, { 'functions/src/asserted.ts': 'const a = db.collection(<string>"jobs");' });
    expect(at(findings)).toEqual(['functions/src/asserted.ts:1']);
  });

  it('FLAGS a literal on the Admin SDK in every quote, multiline, and as a collection group id', async () => {
    const findings = await run(guard, {
      'functions/src/admin.ts': [
        "const a = groupRef.collection('countedReports').doc(reportId);",
        'const b = db.collection("jobs");',
        'const c = workRef.collection(SUB).doc(`reservation`);',
        "const d = db.collection(\n  'auditEvents',\n);",
        'const e = db.collectionGroup("games");',
        'const f = db.doc("landing/admin");',
      ].join('\n'),
    });
    expect(at(findings)).toEqual([
      'functions/src/admin.ts:1',
      'functions/src/admin.ts:2',
      'functions/src/admin.ts:3',
      'functions/src/admin.ts:4',
      'functions/src/admin.ts:7',
      'functions/src/admin.ts:8',
    ]);
  });

  it('FLAGS every typed link of a chain, not just the first, and a typed link after a constant', async () => {
    const findings = await run(guard, {
      'functions/src/chain.ts': [
        'const a = db.collection("landing").doc("admin");',
        "const b = db\n  .collection('landing')\n  .doc('admin');",
        'const c = db.collection(COLLECTIONS.USERS).doc(userId).collection("historical").doc("basketball");',
      ].join('\n'),
    });
    expect(at(findings)).toEqual([
      'functions/src/chain.ts:1',
      'functions/src/chain.ts:1',
      'functions/src/chain.ts:3',
      'functions/src/chain.ts:4',
      'functions/src/chain.ts:5',
      'functions/src/chain.ts:5',
    ]);
  });

  it('FLAGS a literal hoisted into a file-local binding of any keyword, typed, exported, or without a semicolon', async () => {
    const findings = await run(guard, {
      'functions/src/a.ts': "const AUDIT = 'auditEvents';\nexport const n = () => db.collection(AUDIT).count();",
      'functions/src/b.ts': 'const ID: string = "cursor";\nconst ref = db.collection(COLLECTIONS.SERVER).doc(ID);',
      'functions/src/c.ts': "let R = 'roster'\nconst ref = gameRef.collection(R);",
      'functions/src/d.ts': "export var R = 'roster';\nconst ref = gameRef.collection(R);",
      'src/e.ts': "const USERS = 'users';\nconst ref = doc(db, USERS, uid);",
    });
    expect(at(findings)).toEqual(['functions/src/a.ts:2', 'functions/src/b.ts:2', 'functions/src/c.ts:2', 'functions/src/d.ts:2', 'src/e.ts:2']);
  });

  it('FLAGS a literal in ANY modular path position, behind a spread owner, multiline, and on a call handle', async () => {
    const findings = await run(guard, {
      'src/modular.ts': [
        "const a = doc(db, COLLECTIONS.LEAGUES, id, 'games', gid);",
        "const b = doc(db, ...SEGMENTS.league(id), 'games', gid);",
        'const c = collection(db, "products");',
        "const d = collectionGroup(db, 'teams');",
        'const e = doc(\n  getDb(),\n  "leagues",\n  leagueId,\n);',
      ].join('\n'),
    });
    expect(at(findings)).toEqual(['src/modular.ts:1', 'src/modular.ts:2', 'src/modular.ts:3', 'src/modular.ts:4', 'src/modular.ts:5']);
  });

  it('reads no test code', async () => {
    expect(await run(guard, { 'src/thing.test.ts': "db.collection('jobs');", 'src/__tests__/x.ts': "db.collection('jobs');" })).toEqual([]);
  });

  it('refuses facts: it takes none', () => {
    expect(literalSegmentGuard.factProblems({ x: 1 } as never)).toEqual(['this guard takes no facts: declare it with {}']);
    expect(literalSegmentGuard.factProblems({})).toEqual([]);
  });
});

describe('no Firestore path is assembled by hand', () => {
  const facts = (over: Partial<PathAssemblyFacts> = {}): PathAssemblyFacts => ({
    ownerConstants: ['COLLECTIONS', 'PATHS'],
    segmentArrayJoiners: ['toPath'],
    reviewedSites: [],
    ...over,
  });

  it('PASSES the owner builders, computed ids, trigger patterns, a collection prefix, and slashes outside the accessor', async () => {
    const [guard] = pathAssemblyGuard.build(facts());
    const clean = [
      'const a = db.doc(toPath(PATH_BUILDERS.reservation(id)));',
      'const b = db.doc(PATHS.league(leagueId));',
      'const c = db.doc(docPath(COLLECTIONS.LEAGUES, leagueId));',
      'const d = db.collection(COLLECTIONS.MEMBERS).doc(`${leagueId}_${teamId}_${uid}`);',
      'const e = { document: `${COLLECTIONS.USER_PROFILES}/{uid}` };',
      'const f = { document: `${COLLECTIONS.USER_PROFILES}/{uid}/${SUBS.LIKES}/{likeId}` };',
      'const g = `${COLLECTIONS.CASES}/`;',
      "const h = db.collection(COLLECTIONS.LEAGUES).where('url', '==', base + '/x');",
      "const i = db.collection(COLLECTIONS.LEAGUES).doc(id).update({ note: prefix + '/y' });",
      'const j = doc(db, ...SEGMENTS.signup(`${leagueId}_${userId}`));',
      '// never write db.doc(`${COLLECTIONS.LANDING}/base`)',
    ].join('\n');
    expect(await run(guard, { 'src/clean.ts': clean, 'functions/src/clean.ts': clean })).toEqual([]);
  });

  it('FLAGS every assembly shape: spliced owner, slash-and-hole templates in either order, concatenation, a joined id, and a hand-built joiner array', async () => {
    const [guard] = pathAssemblyGuard.build(facts());
    const findings = await run(guard, {
      'functions/src/assemble.ts': [
        'const a = db.doc(`${COLLECTIONS.LANDING}/base`);',
        'const b = db.doc(\n  `${COLLECTIONS.LANDING}/base`,\n);',
        'const c = db.doc(`${dstDoc.path}/${rel}`);',
        'const d = db.doc(`backup/root/${id}`);',
        'const e = COLLECTIONS.LEAGUES + "/" + leagueId;',
        "const f = 'leagues/' + PATHS.league;",
        "const g = db.doc('leagues/' + leagueId);",
        "const h = db.doc(gameDoc.path + '/roster/' + userId);",
        'const i = { targetRef: `${COLLECTIONS.ADMIN_TASKS}/${taskId}` };',
        'const j = db.doc(toPath(\n  [ COLLECTIONS.USER_PROFILES, uid ],\n));',
      ].join('\n'),
      'src/modular.ts': 'const ref = doc(db, `${COLLECTIONS.LEAGUES}/${leagueId}`);\nconst r2 = doc(db, "leagues/" + leagueId);',
    });
    expect(at(findings)).toEqual([
      'functions/src/assemble.ts:1',
      'functions/src/assemble.ts:3',
      'functions/src/assemble.ts:5',
      'functions/src/assemble.ts:6',
      'functions/src/assemble.ts:7',
      'functions/src/assemble.ts:8',
      'functions/src/assemble.ts:9',
      'functions/src/assemble.ts:10',
      'functions/src/assemble.ts:11',
      'functions/src/assemble.ts:13',
      'src/modular.ts:1',
      'src/modular.ts:2',
    ]);
  });

  it('PASSES a reviewed site, and FLAGS a reviewed site that no longer assembles a path', async () => {
    const [guard] = pathAssemblyGuard.build(
      facts({
        reviewedSites: [
          { path: 'functions/src/irregular.ts', why: 'a parent locator with no single builder' },
          { path: 'functions/src/fixed.ts', why: 'was irregular' },
        ],
      }),
    );
    const findings = await run(guard, {
      'functions/src/irregular.ts': 'const p = `${COLLECTIONS.REPORTS}/${id}/${sub}`;',
      'functions/src/fixed.ts': 'const p = toPath(PATH_BUILDERS.report(id));',
    });
    expect(findings).toEqual([{ file: 'functions/src/fixed.ts', detail: 'stale reviewed site: the file no longer assembles a path (or is gone)' }]);
  });

  it('refuses missing owner constants, a missing joiner list, and a reviewed site with no why', () => {
    expect(pathAssemblyGuard.factProblems({ segmentArrayJoiners: [], reviewedSites: [{ path: 'a.ts', why: ' ' }] } as never)).toEqual([
      'ownerConstants is missing',
      'reviewedSites entry a.ts carries no why',
    ]);
    expect(pathAssemblyGuard.factProblems({ ownerConstants: [], reviewedSites: [] } as never)).toEqual([
      'ownerConstants is empty',
      'segmentArrayJoiners is missing (declare [] when there is none)',
    ]);
  });
});

describe('no retired Firestore segment survives in a path string', () => {
  const facts = (over: Partial<RetiredSegmentFacts> = {}): RetiredSegmentFacts => ({
    segments: [
      { name: 'tales', replacement: 'hallTales' },
      { name: 'private', replacement: 'privateDetails' },
      { name: 'actions', replacement: 'requestActions' },
    ],
    reviewedMatches: [],
    ...over,
  });

  it('FLAGS a retired name in path position in strings and templates, in every root and in test code, and as a collection group id', async () => {
    const [guard] = retiredSegmentGuard.build(facts());
    const findings = await run(
      guard,
      {
        'src/a.ts': "const p = 'works/w1/tales/t1';",
        'functions/src/b.ts': 'const p = `/requests/${id}/actions/a`;\nconst q = "base/x/private";',
        'functions/src/c.test.ts': 'db.collectionGroup( "private" );',
        'e2e/d.ts': "await seed('works/w1/tales');",
        'workers/chat/src/e.ts': "collectionGroup(db, 'actions');",
      },
      { e2e: { path: 'e2e', anchor: 'e2e/d.ts' }, workers: { chat: { path: 'workers/chat/src', anchor: 'workers/chat/src/e.ts' } } },
    );
    expect(findings.map((f) => `${f.file}:${f.line} ${f.detail.split(' in ')[0]}`)).toEqual([
      "e2e/d.ts:1 retired segment 'tales' (now 'hallTales')",
      "functions/src/b.ts:1 retired segment 'actions' (now 'requestActions')",
      "functions/src/b.ts:2 retired segment 'private' (now 'privateDetails')",
      "functions/src/c.test.ts:1 retired segment 'private' (now 'privateDetails')",
      "src/a.ts:1 retired segment 'tales' (now 'hallTales')",
      "workers/chat/src/e.ts:1 retired segment 'actions' (now 'requestActions')",
    ]);
  });

  it('PASSES a longer word, the new name, a name before a hole, prose, and a bare word outside path position', async () => {
    const [guard] = retiredSegmentGuard.build(facts());
    const clean = [
      "const a = '/talesmen/x';",
      "const b = '/hallTales/t1';",
      'const c = `/tales${suffix}`;',
      "// 'works/w1/tales/t1' in a comment",
      "const d = { kind: 'tales' };",
      "db.collectionGroup('privateDetails');",
    ].join('\n');
    expect(await run(guard, { 'src/clean.ts': clean })).toEqual([]);
  });

  it('PASSES a reviewed match, and FLAGS one that matches nothing', async () => {
    const [guard] = retiredSegmentGuard.build(
      facts({
        reviewedMatches: [
          { file: 'src/emulator.ts', contains: '/emulator/v1/', why: 'an Auth emulator endpoint, not a collection' },
          { file: 'src/gone.ts', contains: 'nothing', why: 'stale' },
        ],
      }),
    );
    const findings = await run(guard, { 'src/emulator.ts': 'const u = `${host}/emulator/v1/projects/${p}/actions/x`;', 'src/gone.ts': 'export {};' });
    expect(findings).toEqual([{ file: 'src/gone.ts', detail: 'stale reviewed match: no retired segment in a literal containing "nothing"' }]);
  });

  it('refuses an empty segment list, a segment with no replacement, and a reviewed match with no text or why', () => {
    expect(retiredSegmentGuard.factProblems({ segments: [], reviewedMatches: [] })).toEqual(['segments is empty (declare the guard absent instead)']);
    expect(
      retiredSegmentGuard.factProblems({
        segments: [{ name: 'tales', replacement: '' }, { name: 'a/b', replacement: 'x' }],
        reviewedMatches: [{ file: 'src/a.ts', contains: '', why: '' }],
      }),
    ).toEqual([
      'reviewedMatches entry src/a.ts names no text it contains',
      'reviewedMatches entry src/a.ts carries no why',
      'segments: tales names no replacement',
      'segments: a/b is not a segment name',
    ]);
  });
});
