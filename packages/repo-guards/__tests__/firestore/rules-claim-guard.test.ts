// Every rules file the layout lists reads only the core's claim names, and every role helper checks
// its claim AND the live roster document, reading no other document.

import { afterEach, describe, expect, it } from 'vitest';
import { rulesClaimGuard, type RulesClaimFacts } from '../../src/modules/firestore/rules-claim-guard.js';
import { createRepoReader } from '../../src/reader/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

const facts = (over: Partial<RulesClaimFacts> = {}): RulesClaimFacts => ({
  claims: () => ['operator', 'reviewer', 'member'],
  roleHelpers: [
    { function: 'isOperator', claim: () => 'operator', rosterField: () => 'operators' },
    { function: 'isStaff', claim: () => 'operator', rosterField: () => 'operators' },
    { function: 'isReviewer', claim: () => 'reviewer', rosterField: () => 'reviewers' },
  ],
  rosterPath: () => '_roster/staff',
  ...over,
});

const OPERATOR = [
  'function isOperator() {',
  "  return request.auth != null && request.auth.token.get('operator', false) == true",
  "    && request.auth.uid in get(/databases/$(database)/documents/_roster/staff).data.get('operators', []);",
  '}',
].join('\n');

const FIRESTORE = [
  "rules_version = '2';",
  'service cloud.firestore {',
  '  match /databases/{database}/documents {',
  '    // A retired shape kept as prose: request.auth.token.isOperator, get(/databases/$(database)/documents/roles/x)',
  '    match /notes/{noteId} {',
  '      allow read: if isMember() && request.auth.token.email_verified == true;',
  '      allow write: if isStaff();',
  '    }',
  OPERATOR,
  '    function isStaff() { return isOperator(); }',
  '    function isMember() { return request.auth != null && request.auth.token.member == true; }',
  '  }',
  '}',
].join('\n');

const STORAGE = [
  'service firebase.storage {',
  '  match /b/{bucket}/o {',
  '    match /files/{userId}/{fileId} { allow read: if request.auth.uid == userId || isOperator(); }',
  '    function isOperator() {',
  '      return request.auth != null',
  '        && request.auth.token.operator == true',
  '        && request.auth.uid in firestore.get(/databases/(default)/documents/_roster/staff).data.operators;',
  '    }',
  '  }',
  '}',
].join('\n');

async function run(
  files: Record<string, string>,
  f = facts({ roleHelpers: facts().roleHelpers.slice(0, 2) }),
  rulesFiles: readonly string[] = ['firestore.rules', 'storage.rules'],
) {
  repo = tempRepo({ 'src/anchor.ts': 'export {};', 'firestore.rules': FIRESTORE, 'storage.rules': STORAGE, ...files });
  const reader = createRepoReader({ repoRoot: repo.root, roots: { app: { path: 'src', anchor: 'src/anchor.ts' } }, rulesFiles });
  const [guard] = rulesClaimGuard.build(f);
  return guard.run(contextOf(reader));
}

/** A firestore.rules file holding just these functions. */
const rules = (...lines: string[]) => ['service cloud.firestore {', '  match /databases/{database}/documents {', ...lines, '  }', '}'].join('\n');

describe("the rules read the core's claim names, and every role helper checks its claim and the live roster", () => {
  it('PASSES both accessor spellings, a delegating helper, a cross-service roster read, platform token fields, and claims in prose', async () => {
    expect(await run({})).toEqual([]);
  });

  it('FLAGS a claim the core does not declare, wherever the rules read it', async () => {
    const findings = await run({
      'firestore.rules': FIRESTORE.replace("token.member == true", "token.get('registered', false) == true"),
      'storage.rules': STORAGE.replace('request.auth.uid == userId', "request.auth.token['uploader'] == true"),
    });
    expect(findings).toEqual([
      { file: 'firestore.rules', line: 14, detail: 'reads the claim registered, which the core does not declare' },
      { file: 'storage.rules', line: 3, detail: 'reads the claim uploader, which the core does not declare' },
    ]);
  });

  it('FLAGS a role helper that reads its claim but not the live roster', async () => {
    const findings = await run({
      'firestore.rules': rules(
        "    function isOperator() { return request.auth != null && request.auth.token.get('operator', false) == true; }",
        '    function isStaff() { return isOperator(); }',
      ),
    });
    expect(findings).toEqual([
      { file: 'firestore.rules', line: 3, detail: 'isOperator() does not read the live roster _roster/staff' },
      { file: 'firestore.rules', line: 4, detail: 'isStaff() does not read the live roster _roster/staff' },
    ]);
  });

  it('FLAGS a role helper that reads its role from another document, in either service spelling', async () => {
    const findings = await run({
      'firestore.rules': rules(
        '    function isOperator() {',
        '      let roleDoc = firestore.get(/databases/(default)/documents/roleStore/operator);',
        '      return request.auth != null && roleDoc.data.operators[request.auth.uid] == true;',
        '    }',
        "    function isStaff() { return request.auth.token.operator == true && request.auth.uid in get(/databases/$(database)/documents/_roster/staff).data.operators && exists(/databases/$(database)/documents/legacyRoles/$(request.auth.uid)); }",
      ),
    });
    expect(findings).toEqual([
      { file: 'firestore.rules', line: 3, detail: 'isOperator() reads the claims []; it checks exactly the claim operator' },
      { file: 'firestore.rules', line: 3, detail: 'isOperator() reads the document roleStore/operator; a role helper reads only the roster _roster/staff' },
      { file: 'firestore.rules', line: 3, detail: 'isOperator() does not read the live roster _roster/staff' },
      { file: 'firestore.rules', line: 7, detail: 'isStaff() reads the document legacyRoles/{}; a role helper reads only the roster _roster/staff' },
    ]);
  });

  it('FLAGS a helper reading another role claim, two claims, or one claim swapped with its pair', async () => {
    const roster = "request.auth.uid in get(/databases/$(database)/documents/_roster/staff).data.get('operators', [])";
    const reviewerRoster = "request.auth.uid in get(/databases/$(database)/documents/_roster/staff).data.reviewers";
    const findings = await run(
      {
        'firestore.rules': rules(
          `    function isOperator() { return request.auth.token.reviewer == true && ${roster}; }`,
          `    function isStaff() { return (request.auth.token.operator == true || request.auth.token.reviewer == true) && ${roster}; }`,
          `    function isReviewer() { return request.auth.token.get('operator', false) == true && ${reviewerRoster}; }`,
        ),
        'storage.rules': STORAGE.replace('isOperator()', 'false'),
      },
      facts(),
    );
    expect(findings.filter((f) => f.file === 'firestore.rules' && f.line !== undefined && !f.detail.startsWith('reads the role claim'))).toEqual([
      { file: 'firestore.rules', line: 3, detail: 'isOperator() reads the claims [reviewer]; it checks exactly the claim operator' },
      { file: 'firestore.rules', line: 4, detail: 'isStaff() reads the claims [operator, reviewer]; it checks exactly the claim operator' },
      { file: 'firestore.rules', line: 4, detail: 'isStaff() joins its checks with ||; the claim and the roster must both hold' },
      { file: 'firestore.rules', line: 5, detail: 'isReviewer() reads the claims [operator]; it checks exactly the claim reviewer' },
    ]);
  });

  it('FLAGS a role claim read inline, outside its role helper, which skips the roster', async () => {
    const findings = await run({
      'firestore.rules': FIRESTORE.replace('allow write: if isStaff();', "allow write: if request.auth.token.get('operator', false) == true;"),
      'storage.rules': STORAGE.replace('request.auth.uid == userId', 'request.auth.token.operator == true'),
    });
    expect(findings).toEqual([
      { file: 'firestore.rules', line: 7, detail: 'reads the role claim operator outside its role helper (isOperator, isStaff), skipping the roster' },
      { file: 'storage.rules', line: 3, detail: 'reads the role claim operator outside its role helper (isOperator, isStaff), skipping the roster' },
    ]);
  });

  it("FLAGS a roster read that never tests the caller's uid against the role's list", async () => {
    const findings = await run({
      'storage.rules': STORAGE.replace('.data.operators;', '.data.reviewers;'),
    });
    expect(findings).toEqual([{ file: 'storage.rules', line: 4, detail: "isOperator() does not test the caller's uid against the roster's operators list" }]);
  });

  it('FLAGS a document read through a path the check cannot name, and a helper reaching another read through a call', async () => {
    const findings = await run({
      'firestore.rules': FIRESTORE.replace(
        '    function isStaff() { return isOperator(); }',
        [
          '    function isStaff() { return isOperator() && teamOf(request.auth.uid) != null && get(rosterPath()).data.size() > 0; }',
          '    function teamOf(uid) { return get(/databases/$(database)/documents/teams/$(uid)).data; }',
          '    function rosterPath() { return /databases/$(database)/documents/_roster/staff; }',
        ].join('\n'),
      ),
    });
    expect(findings).toEqual([
      { file: 'firestore.rules', line: 13, detail: 'isStaff() reads the document teams/{}; a role helper reads only the roster _roster/staff' },
      { file: 'firestore.rules', line: 13, detail: 'isStaff() reads a document through a path the check cannot name; it reads the roster by its own path' },
    ]);
  });

  it('FLAGS a rules file that reads a role claim in a function that is not its role helper', async () => {
    const findings = await run({ 'storage.rules': STORAGE.replace('function isOperator()', 'function isAdmin()') });
    expect(findings).toEqual([
      { file: 'storage.rules', line: 6, detail: 'reads the role claim operator outside its role helper (isOperator, isStaff), skipping the roster' },
    ]);
  });

  it('FLAGS a bound role helper that no listed rules file declares', async () => {
    const findings = await run({}, facts());
    expect(findings).toEqual([{ file: '(config)', detail: 'no listed rules file declares the role helper isReviewer()' }]);
  });

  it("reads every rules file the layout lists, of either service, and none it does not list", async () => {
    const extra = (claim: string) => rules(`    function isGate() { return request.auth.token.${claim} == true; }`);
    const findings = await run(
      { 'admin.rules': extra('auditor'), 'unlisted.rules': extra('stranger') },
      undefined,
      ['firestore.rules', 'storage.rules', 'admin.rules'],
    );
    expect(findings).toEqual([{ file: 'admin.rules', line: 3, detail: 'reads the claim auditor, which the core does not declare' }]);
  });

  it('reports a role helper bound to a claim the core does not declare, and a core that declares no claim', async () => {
    const findings = await run({}, facts({ claims: () => [], roleHelpers: facts().roleHelpers.slice(0, 2) }));
    expect(findings.slice(0, 3)).toEqual([
      { file: '(config)', detail: 'the core declares no claim, so the check reads nothing' },
      { file: '(config)', detail: 'role helper isOperator is bound to operator, a claim the core does not declare' },
      { file: '(config)', detail: 'role helper isStaff is bound to operator, a claim the core does not declare' },
    ]);
  });

  it('refuses missing facts, a helper with no claim loader, and a helper bound twice', () => {
    expect(rulesClaimGuard.factProblems({} as never)).toEqual([
      'claims needs a loader function',
      'rosterPath needs a loader function',
      'roleHelpers is missing (declare [] when there is none)',
    ]);
    const op = facts().roleHelpers[0];
    expect(
      rulesClaimGuard.factProblems(
        facts({
          roleHelpers: [op, op, { function: 'isReviewer', claim: 'reviewer' as never, rosterField: () => 'reviewers' }],
        }),
      ),
    ).toEqual(['roleHelpers: isOperator is listed twice', 'roleHelpers isReviewer claim needs a loader function']);
  });
});
