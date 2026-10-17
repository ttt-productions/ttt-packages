// The collection-group index guard: a filtered collection-group query with no collection-group index
// fails on both SDKs; an index of the right scope, an unfiltered scan, and a reviewed unresolvable
// site pass; an id that cannot be resolved fails unless reviewed, and a stale review fails.

import { afterEach, describe, expect, it } from 'vitest';
import { collectionGroupIndexGuard, type CollectionGroupIndexFacts } from '../../src/modules/firestore/index-guard.js';
import { createRepoReader } from '../../src/reader/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const INDEXES = JSON.stringify({
  indexes: [
    { collectionGroup: 'members', queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'teamId' }, { fieldPath: 'status' }] },
    { collectionGroup: 'posts', queryScope: 'COLLECTION', fields: [{ fieldPath: 'authorId' }, { fieldPath: 'hidden' }] },
    { collectionGroup: 'entries', queryScope: 'COLLECTION_GROUP', fields: [{ fieldPath: 'rank' }, { fieldPath: 'ownerId' }] },
  ],
  fieldOverrides: [
    { collectionGroup: 'messages', fieldPath: 'senderId', indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION_GROUP' }] },
    { collectionGroup: 'likes', fieldPath: 'userId', indexes: [{ order: 'ASCENDING', queryScope: 'COLLECTION' }] },
  ],
});

const CORE = { SUBCOLLECTIONS: { MESSAGES: 'messages', LIKES: 'likes' }, COLLECTIONS: { MEMBERS: 'members' } };

const facts = (over: Partial<CollectionGroupIndexFacts> = {}): CollectionGroupIndexFacts => ({
  indexesFile: 'firestore.indexes.json',
  coreExports: async () => CORE,
  unresolvable: [],
  ...over,
});

async function run(files: Record<string, string>, f = facts()) {
  repo = tempRepo({ 'firestore.indexes.json': INDEXES, 'src/anchor.ts': 'export {};', 'functions/src/anchor.ts': 'export {};', ...files });
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/anchor.ts' }, functions: { path: 'functions/src', anchor: 'functions/src/anchor.ts' } },
  });
  const [guard] = collectionGroupIndexGuard.build(f);
  return guard.run(contextOf(reader));
}

describe('every filtered collection-group query is index-backed', () => {
  it('PASSES a covered override, a covered composite in any order, an unfiltered scan, and filters on another statement', async () => {
    expect(
      await run({
        'functions/src/ok.ts': [
          "const a = db.collectionGroup(SUBCOLLECTIONS.MESSAGES).where('senderId', '==', uid).limit(10);",
          "const b = db.collectionGroup('members').where('status', '==', 'active').where('teamId', '==', t);",
          'const c = db.collectionGroup(SUBCOLLECTIONS.LIKES).limit(100);',
          "const d = db.collectionGroup('members');\nconst e = other.where('anything', '==', 1);",
        ].join('\n'),
        'src/ok.ts': "const q = query(collectionGroup(db, COLLECTIONS.MEMBERS), where('teamId', '==', t), where('status', '==', s));",
      }),
    ).toEqual([]);
  });

  it('FLAGS a filtered group with no index, an override of the wrong scope, a composite of the wrong scope, and a composite not led by the one field', async () => {
    const findings = await run({
      'functions/src/missing.ts': [
        "const a = db.collectionGroup('reports').where('reporterId', '==', uid);",
        "const b = db.collectionGroup(SUBCOLLECTIONS.LIKES).where('userId', '==', uid);",
        "const c = db.collectionGroup('posts').where('authorId', '==', a).where('hidden', '==', false);",
        "const d = db.collectionGroup('entries').where('ownerId', '==', uid);",
      ].join('\n'),
    });
    expect(findings.map((f) => `${f.file}:${f.line}`)).toEqual([
      'functions/src/missing.ts:1',
      'functions/src/missing.ts:2',
      'functions/src/missing.ts:3',
      'functions/src/missing.ts:4',
    ]);
    expect(findings[0].detail).toContain('"fieldOverrides" entry for reports.reporterId');
    expect(findings[2].detail).toContain('"indexes" entry for posts scoped COLLECTION_GROUP over authorId, hidden');
  });

  it('FLAGS a modular client query with no index, and resolves a same-file literal binding', async () => {
    const findings = await run({
      'src/client.ts': "const G = 'reports';\nconst q = query(collectionGroup(db, G), where('state', '==', 'open'));",
    });
    expect(findings.map((f) => `${f.file}:${f.line}`)).toEqual(['src/client.ts:2']);
  });

  it('FLAGS a group id it cannot resolve, PASSES a reviewed one, and FLAGS a reviewed site that is gone', async () => {
    const findings = await run(
      {
        'functions/src/param.ts': "export const count = (groupId: string) => db.collectionGroup(groupId).where('x', '==', 1).count();",
        'functions/src/derived.ts': "const g = pickGroup();\nconst q = db.collectionGroup(g).where('y', '==', 2);",
      },
      facts({
        unresolvable: [
          { file: 'functions/src/param.ts', argument: 'groupId', why: 'a parameterized helper; its one caller passes indexed groups' },
          { file: 'functions/src/gone.ts', argument: 'X', why: 'removed' },
        ],
      }),
    );
    expect(findings).toEqual([
      { file: 'functions/src/derived.ts', line: 2, detail: 'collectionGroup(g): the group id does not resolve to a static value' },
      { file: 'functions/src/gone.ts', detail: 'stale unresolvable site: no collectionGroup(X) left' },
    ]);
  });

  it('refuses a missing index file, a missing core loader, and an unresolvable site with no argument or why', () => {
    expect(collectionGroupIndexGuard.factProblems({ unresolvable: [{ file: 'a.ts', argument: '', why: '' }] } as never)).toEqual([
      'indexesFile is missing',
      'coreExports needs a loader function',
      'unresolvable: a.ts carries no why',
      'unresolvable: a.ts names no argument',
    ]);
  });
});
