import { afterEach, describe, expect, it } from 'vitest';
import {
  rulesMirrorFindings,
  rulesMirrorGuard,
  type RulesMirrorFacts,
} from '../../src/modules/firestore/rules-mirror-guard.js';
import { createRepoReader } from '../../src/node/reader.js';
import { viewOfText } from '../../src/reader/view.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const facts = (over: Partial<RulesMirrorFacts> = {}): RulesMirrorFacts => ({
  collections: () => [
    'config',
    'members',
    'members/{memberId}/settings',
    'teams',
    'teams/{teamId}/players',
    'feed/live/posts',
    'feed',
    'lists',
    'lists/{listId}/entries',
  ],
  collectionGroups: () => ['players'],
  fixedDocuments: () => [
    'config/app',
    'members/{memberId}/settings/prefs',
    'feed/live',
    'feed/trending',
  ],
  comparedFields: [
    { field: 'status', values: () => ['open', 'closed'] },
    { field: 'roles', values: () => ['captain', 'coach', 'player'] },
  ],
  valueLists: [{ function: 'isLeader', values: () => ['captain', 'coach'] }],
  ...over,
});

const CANONICAL = [
  "rules_version = '2';",
  'service cloud.firestore {',
  '  match /databases/{database}/documents {',
  '    match /{document=**} {',
  '      allow read, write: if false;',
  '    }',
  '    // match /{anyList}/{entryId} in prose is not a block',
  '    match /config/{docId} { allow read: if true; }',
  "    match /members/{memberId} { allow read: if resource.data.status == 'open'; }",
  '    match /members/{memberId}/settings/prefs { allow read: if request.auth.uid == memberId; }',
  '    match /teams/{teamId} {',
  "      allow read: if resource.data.get('status', 'open') != 'closed' && isLeader(teamId);",
  '      match /players/{playerId} {',
  "        allow read: if 'player' in resource.data.roles || resource.data.roles.hasAny(['coach']);",
  '      }',
  '    }',
  '    match /{path=**}/players/{playerId} { allow read: if hasRole(teamOf(playerId), []); }',
  '    match /feed/trending { allow read: if true; }',
  '    match /feed/live/posts/{postId} { allow read: if true; }',
  '    match /lists/{listId} {',
  '      allow read: if false;',
  '      match /entries/{entryId} { allow read: if false; }',
  '    }',
  '    function teamOf(id) { return get(/databases/$(database)/documents/teams/$(id)).data; }',
  '    function app() { return get(/databases/$(database)/documents/config/app).data; }',
  '    function hasRole(team, roles) { return team.roles.hasAny(roles); }',
  "    function isLeader(teamId) { return hasRole(teamOf(teamId), ['captain', 'coach']) && teamOf(teamId).id.split('_')[0] != null; }",
  '  }',
  '}',
].join('\n');

const check = (text: string, f = facts()) =>
  rulesMirrorFindings(viewOfText('firestore.rules', text), f);

describe('the Firestore rules mirror the core exactly', () => {
  it('PASSES a rules file built from the declarations, read through the repository', async () => {
    repo = tempRepo({ 'src/anchor.ts': 'export {};', 'firestore.rules': CANONICAL });
    const reader = createRepoReader({
      repoRoot: repo.root,
      roots: { app: { path: 'src', anchor: 'src/anchor.ts' } },
      rulesFiles: ['firestore.rules'],
    });
    const [guard] = rulesMirrorGuard.build(facts());
    expect(await guard.run(contextOf(reader))).toEqual([]);
  });

  it('reads every Firestore rules file the layout lists, and never a Storage rules file', async () => {
    const storage =
      'service firebase.storage { match /b/{bucket}/o { match /{anyFolder}/{fileId} { allow read: if true; } } }';
    repo = tempRepo({
      'src/anchor.ts': 'export {};',
      'firestore.rules': CANONICAL,
      'second.rules': CANONICAL.replace('match /entries/{entryId}', 'match /{listName}/{entryId}'),
      'storage.rules': storage,
    });
    const reader = createRepoReader({
      repoRoot: repo.root,
      roots: { app: { path: 'src', anchor: 'src/anchor.ts' } },
      rulesFiles: ['firestore.rules', 'second.rules', 'storage.rules'],
    });
    const [guard] = rulesMirrorGuard.build(facts());
    expect(await guard.run(contextOf(reader))).toEqual([
      {
        file: 'second.rules',
        line: 22,
        detail:
          'the block /lists/{listId}/{listName}/{entryId} matches any collection name with {listName}; give each declared collection its own block',
      },
      {
        file: 'second.rules',
        detail: 'no match block of its own for the declared collection lists/{}/entries',
      },
    ]);
  });

  it('FLAGS a wildcard collection-name segment, nested under a parent or written in one path', async () => {
    const nested = CANONICAL.replace('match /entries/{entryId}', 'match /{listName}/{entryId}');
    expect(await check(nested)).toEqual([
      {
        file: 'firestore.rules',
        line: 22,
        detail:
          'the block /lists/{listId}/{listName}/{entryId} matches any collection name with {listName}; give each declared collection its own block',
      },
      {
        file: 'firestore.rules',
        detail: 'no match block of its own for the declared collection lists/{}/entries',
      },
    ]);
    const flat = CANONICAL.replace('match /players/{playerId} {', 'match /{kind}/{itemId} {');
    expect(await check(flat)).toEqual([
      {
        file: 'firestore.rules',
        line: 13,
        detail:
          'the block /teams/{teamId}/{kind}/{itemId} matches any collection name with {kind}; give each declared collection its own block',
      },
      {
        file: 'firestore.rules',
        detail: 'no match block of its own for the declared collection teams/{}/players',
      },
    ]);
  });

  it('FLAGS a block for an undeclared collection, at the top or nested, and a declared collection with no block', async () => {
    const text = CANONICAL.replace('match /config/{docId}', 'match /settings/{docId}').replace(
      'match /players/{playerId} {',
      'match /bench/{playerId} {',
    );
    expect(await check(text)).toEqual([
      {
        file: 'firestore.rules',
        line: 8,
        detail:
          'the block /settings/{docId} names the collection settings, which the core does not declare',
      },
      {
        file: 'firestore.rules',
        line: 13,
        detail:
          'the block /teams/{teamId}/bench/{playerId} names the collection teams/{}/bench, which the core does not declare',
      },
      {
        file: 'firestore.rules',
        detail: 'no match block of its own for the declared collection config',
      },
      {
        file: 'firestore.rules',
        detail: 'no match block of its own for the declared collection teams/{}/players',
      },
    ]);
  });

  it('FLAGS a fixed document the core does not declare, in a block and in a read', async () => {
    const text = CANONICAL.replace('match /feed/trending', 'match /feed/hot').replace(
      'documents/config/app)',
      'documents/config/beta)',
    );
    expect(await check(text)).toEqual([
      {
        file: 'firestore.rules',
        line: 18,
        detail:
          'the block /feed/hot names the fixed document feed/hot, which the core does not declare',
      },
      {
        file: 'firestore.rules',
        line: 25,
        detail:
          'the read /databases/$(database)/documents/config/beta names the fixed document config/beta, which the core does not declare',
      },
    ]);
  });

  it('FLAGS a read of an undeclared collection, and one that builds its collection name at run time', async () => {
    const text = CANONICAL.replace('documents/teams/$(id)', 'documents/squads/$(id)').replace(
      'documents/config/app)',
      'documents/$(kind)/app)',
    );
    expect(await check(text)).toEqual([
      {
        file: 'firestore.rules',
        line: 24,
        detail:
          'the read /databases/$(database)/documents/squads/$(id) names the collection squads, which the core does not declare',
      },
      {
        file: 'firestore.rules',
        line: 25,
        detail:
          'the read /databases/$(database)/documents/$(kind)/app builds a collection name at run time',
      },
    ]);
  });

  it('FLAGS a collection-group block on an undeclared group, a recursive wildcard anywhere else, and a granting catch-all', async () => {
    const text = CANONICAL.replace('match /{path=**}/players/', 'match /{path=**}/bench/')
      .replace('match /feed/live/posts/{postId}', 'match /feed/{rest=**}')
      .replace('allow read, write: if false;', 'allow read: if request.auth != null;');
    expect(await check(text)).toEqual([
      {
        file: 'firestore.rules',
        line: 4,
        detail: 'the catch-all /{document=**} grants something; it only denies',
      },
      {
        file: 'firestore.rules',
        line: 17,
        detail:
          'the collection-group block /{path=**}/bench/{playerId} names bench, which the core declares as no collection group',
      },
      {
        file: 'firestore.rules',
        line: 19,
        detail:
          'the block /feed/{rest=**} spans collections it does not name; only the top-level deny-all catch-all and a {path=**}/<group>/{id} collection-group block may hold a recursive wildcard',
      },
      {
        file: 'firestore.rules',
        detail: 'no match block of its own for the declared collection feed/live/posts',
      },
    ]);
  });

  it('FLAGS a block ending on a collection, a block outside the documents root, and a file with no root', async () => {
    const text = CANONICAL.replace(
      'match /feed/trending {',
      'match /feed/trending/posts {',
    ).replace(
      "rules_version = '2';",
      "rules_version = '2';\nmatch /stray/{id} { allow read: if true; }",
    );
    expect(await check(text)).toEqual([
      {
        file: 'firestore.rules',
        line: 2,
        detail: 'the block match /stray/{id} sits outside the documents root',
      },
      {
        file: 'firestore.rules',
        line: 19,
        detail: 'the block /feed/trending/posts ends on a collection, not a document',
      },
      {
        file: 'firestore.rules',
        detail: 'no match block of its own for the declared collection feed',
      },
    ]);
    expect(
      await check(
        'service cloud.firestore { match /members/{id} { allow read: if true; } }',
        facts({ valueLists: [] }),
      ),
    ).toEqual([
      {
        file: 'firestore.rules',
        detail:
          'no match /databases/{database}/documents block, so no collection block can be read',
      },
    ]);
  });

  it('FLAGS a status or role the core does not declare: compared either way round, through get(), in a membership test, and in a list', async () => {
    const text = CANONICAL.replace(
      "resource.data.status == 'open'",
      "'draft' == resource.data.status",
    )
      .replace(
        "resource.data.get('status', 'open') != 'closed'",
        "resource.data.get('status', 'open') != 'archived'",
      )
      .replace("'player' in resource.data.roles", "'scout' in resource.data.roles")
      .replace("hasAny(['coach'])", "hasAny(['coach', 'medic'])")
      .replace("['captain', 'coach']) &&", "['captain', 'owner']) &&");
    expect(await check(text, facts({ valueLists: [] }))).toEqual([
      {
        file: 'firestore.rules',
        line: 9,
        detail: "compares the field status to 'draft', which the core does not declare for it",
      },
      {
        file: 'firestore.rules',
        line: 12,
        detail: "compares the field status to 'archived', which the core does not declare for it",
      },
      {
        file: 'firestore.rules',
        line: 14,
        detail:
          "tests 'scout' for membership in the field roles, which the core does not declare for it",
      },
      {
        file: 'firestore.rules',
        line: 14,
        detail: "lists 'medic' for the field roles, which the core does not declare for it",
      },
      {
        file: 'firestore.rules',
        line: 27,
        detail: "lists 'owner' for the field roles, which the core does not declare for it",
      },
    ]);
  });

  it('FLAGS a compared field the config declares no values for, a value compared to no field, and a list bound to no field', async () => {
    const text = CANONICAL.replace(
      'allow read: if true; }\n    match /members/{memberId} {',
      "allow read: if docId == 'app' && resource.data.tier == 'gold'; }\n    match /members/{memberId} {",
    ).replace(
      'match /feed/trending { allow read: if true; }',
      "match /feed/trending { allow read: if request.auth.uid in ['a-uid']; }",
    );
    expect(await check(text)).toEqual([
      {
        file: 'firestore.rules',
        line: 8,
        detail:
          "compares 'app' against something that is no stored field; compare a declared field, or name a fixed document as its own block",
      },
      {
        file: 'firestore.rules',
        line: 8,
        detail: "compares the field tier to 'gold', and the config declares no values for tier",
      },
      {
        file: 'firestore.rules',
        line: 18,
        detail: "lists 'a-uid' for the field uid, and the config declares no values for uid",
      },
    ]);
  });

  it('FLAGS a declared list spelled with a member missing or added, a function gone, and a function spelling two lists', async () => {
    expect(
      await check(
        CANONICAL,
        facts({
          valueLists: [{ function: 'isLeader', values: () => ['captain', 'coach', 'player'] }],
        }),
      ),
    ).toEqual([
      {
        file: 'firestore.rules',
        line: 27,
        detail: 'isLeader() lists [captain, coach], the core declares [captain, coach, player]',
      },
    ]);
    expect(
      await check(
        CANONICAL,
        facts({ valueLists: [{ function: 'isOwner', values: () => ['captain'] }] }),
      ),
    ).toEqual([{ file: 'firestore.rules', detail: 'declares no isOwner() function' }]);
    const twice = CANONICAL.replace(
      "['captain', 'coach']) &&",
      "['captain', 'coach']) && hasRole(teamOf(teamId), ['coach']) &&",
    );
    expect(await check(twice)).toEqual([
      {
        file: 'firestore.rules',
        line: 27,
        detail: 'isLeader() spells 2 value lists; it spells exactly one',
      },
    ]);
  });

  it('reports a declared path that is no collection or fixed document, and a core that declares no collection', async () => {
    const findings = await check(
      CANONICAL,
      facts({
        collections: () => ['members/{memberId}'],
        fixedDocuments: () => ['config/{docId}'],
      }),
    );
    expect(findings.slice(0, 2)).toEqual([
      {
        file: '(config)',
        detail: 'the declared collection members/{memberId} is not a collection path',
      },
      {
        file: '(config)',
        detail: 'the declared fixed document config/{docId} is not a fixed document path',
      },
    ]);
    expect((await check(CANONICAL, facts({ collections: () => [] })))[0]).toEqual({
      file: '(config)',
      detail: 'the core declares no collection, so the check reads nothing',
    });
  });

  it('refuses missing loaders and lists, an entry with no loader, and an entry listed twice', () => {
    expect(rulesMirrorGuard.factProblems({} as never)).toEqual([
      'collections needs a loader function',
      'collectionGroups needs a loader function',
      'fixedDocuments needs a loader function',
      'comparedFields is missing (declare [] when there is none)',
      'valueLists is missing (declare [] when there is none)',
    ]);
    expect(
      rulesMirrorGuard.factProblems(
        facts({
          comparedFields: [
            { field: 'status', values: () => [] },
            { field: 'status', values: () => [] },
          ],
          valueLists: [{ function: 'isLeader', values: ['captain'] as never }],
        }),
      ),
    ).toEqual([
      'comparedFields lists status twice',
      "valueLists entry isLeader's values needs a loader function",
    ]);
  });
});
