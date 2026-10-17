// Every rules file the layout lists — Firestore and Storage alike — reads only the custom claims the
// core declares, and every role helper checks its claim AND the live roster document: the token
// answers fast, the roster makes a removed role lose access at once instead of when the stale token
// expires.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import {
  documentPathLiterals,
  enclosingFunction,
  expandedBody,
  normalizeDeclared,
  wildcardPath,
  rulesFunctions,
} from './rules-syntax.js';
import { loaderListProblem, loaderProblem, type Loader } from '../../support/facts.js';
import { escapeRegExp } from '../../support/text.js';

export interface RulesClaimFacts {
  /** Every custom claim name the core declares. */
  claims: Loader<readonly string[]>;
  /**
   * Each role helper: the one claim it checks, and the roster list its caller's uid must be on. Every
   * rules file that declares a function of the helper's name is held to it; at least one must.
   */
  roleHelpers: ReadonlyArray<{ function: string; claim: Loader<string>; rosterField: Loader<string> }>;
  /** The live roster document's path, as the core builds it (`collection/docId`). */
  rosterPath: Loader<string>;
}

/**
 * The token fields Firebase Auth itself sets. They are the platform's, not a custom claim, so no
 * core declares them.
 */
const PLATFORM_TOKEN_FIELDS: ReadonlySet<string> = new Set([
  'aud', 'auth_time', 'email', 'email_verified', 'exp', 'firebase', 'iat', 'iss', 'name', 'phone_number', 'picture', 'sub', 'uid',
]);

/** Every custom-claim read in a text, in both accessor spellings, with its index. */
export function claimReads(text: string): Array<{ index: number; claim: string }> {
  const reads: Array<{ index: number; claim: string }> = [];
  for (const m of text.matchAll(/request\s*\.\s*auth\s*\.\s*token\s*\.\s*get\s*\(\s*['"]([^'"]+)['"]/g)) {
    reads.push({ index: m.index as number, claim: m[1] });
  }
  for (const m of text.matchAll(/request\s*\.\s*auth\s*\.\s*token\s*\.\s*([A-Za-z_$][\w$]*)\b(?!\s*\()/g)) {
    reads.push({ index: m.index as number, claim: m[1] });
  }
  for (const m of text.matchAll(/request\s*\.\s*auth\s*\.\s*token\s*\[\s*['"]([^'"]+)['"]\s*\]/g)) {
    reads.push({ index: m.index as number, claim: m[1] });
  }
  return reads.sort((a, b) => a.index - b.index);
}

/** Every document read call in a text: `get(…)` / `exists(…)` (and their `After` forms), either service. */
const DOCUMENT_READ = /(?:\bfirestore\s*\.\s*|(?<![.\w$]))(?:get|getAfter|exists|existsAfter)\s*\(/g;

/** Every way one role helper's expanded body breaks the claim-and-roster pairing, one line each. */
export function roleHelperProblems(
  body: string,
  helper: { function: string; claim: string; rosterField: string },
  rosterPath: string,
): string[] {
  const problems: string[] = [];
  const name = `${helper.function}()`;
  const claims = [...new Set(claimReads(body).map((r) => r.claim))].sort();
  if (claims.length !== 1 || claims[0] !== helper.claim) {
    problems.push(`${name} reads the claims [${claims.join(', ')}]; it checks exactly the claim ${helper.claim}`);
  }
  const reads = [...body.matchAll(DOCUMENT_READ)];
  const paths = documentPathLiterals(body);
  const roster = normalizeDeclared(rosterPath);
  const onRoster = paths.filter((p) => wildcardPath(p.segments) === roster);
  for (const p of paths) {
    if (wildcardPath(p.segments) !== roster) problems.push(`${name} reads the document ${p.segments.join('/')}; a role helper reads only the roster ${rosterPath}`);
  }
  const unnamed = reads.filter((m) => !/^\s*\/databases\//.test(body.slice((m.index as number) + m[0].length)));
  if (unnamed.length) problems.push(`${name} reads a document through a path the check cannot name; it reads the roster by its own path`);
  if (!onRoster.length) problems.push(`${name} does not read the live roster ${rosterPath}`);
  else {
    const field = escapeRegExp(helper.rosterField);
    const pathText = onRoster.map((p) => escapeRegExp(p.text)).join('|');
    const member = new RegExp(
      `request\\s*\\.\\s*auth\\s*\\.\\s*uid\\s+in\\s+(?:firestore\\s*\\.\\s*)?get\\s*\\(\\s*(?:${pathText})\\s*\\)\\s*\\.\\s*data\\s*\\.\\s*(?:get\\s*\\(\\s*['"]${field}['"]|${field}\\b)`,
    );
    if (!member.test(body)) problems.push(`${name} does not test the caller's uid against the roster's ${helper.rosterField} list`);
  }
  if (/\|\|/.test(body)) problems.push(`${name} joins its checks with ||; the claim and the roster must both hold`);
  return problems;
}

export const rulesClaimGuard: GenericGuardDefinition<RulesClaimFacts> = {
  id: 'rulesClaimNames',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    loaderProblem(facts?.claims, 'claims', problems);
    loaderProblem(facts?.rosterPath, 'rosterPath', problems);
    loaderListProblem(facts?.roleHelpers, 'roleHelpers', 'function', ['claim', 'rosterField'], problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: "the rules read the core's claim names, and every role helper checks its claim and the live roster",
        description:
          'A rules file cannot import the core, so every custom claim a listed rules file reads (request.auth.token.<name> or ' +
          ".get('<name>', …)) must be a claim name the core declares; a renamed claim the rules missed denies " +
          'everyone silently. Every role helper is declared by at least one listed rules file, and wherever it is ' +
          'declared it reads exactly its one declared claim AND tests the caller\'s uid against ' +
          'its list on the live roster document, with both required (no ||), so a removed role loses access at once ' +
          'rather than when the stale token expires; it reads no other document. A role claim is read only inside its ' +
          'role helpers — an inline check would skip the roster. Fix: change the rules to the core\'s names and the ' +
          'claim-and-roster helper, or the core and the rules together.',
        async run(context) {
          const declared = new Set(await facts.claims());
          const rosterPath = await facts.rosterPath();
          const helpers = await Promise.all(
            facts.roleHelpers.map(async (h) => ({ function: h.function, claim: await h.claim(), rosterField: await h.rosterField() })),
          );
          const roleClaims = new Map<string, Set<string>>();
          for (const h of helpers) {
            if (!roleClaims.has(h.claim)) roleClaims.set(h.claim, new Set());
            roleClaims.get(h.claim)?.add(h.function);
          }
          const findings: Finding[] = [];
          if (!declared.size) findings.push({ file: '(config)', detail: 'the core declares no claim, so the check reads nothing' });
          for (const h of helpers) {
            if (!declared.has(h.claim)) findings.push({ file: '(config)', detail: `role helper ${h.function} is bound to ${h.claim}, a claim the core does not declare` });
          }
          const declaredSomewhere = new Set<string>();
          for (const file of context.rulesFiles()) {
            const code = file.code;
            const functions = rulesFunctions(code);
            for (const read of claimReads(code)) {
              if (PLATFORM_TOKEN_FIELDS.has(read.claim)) continue;
              const line = file.lineOf(read.index);
              if (!declared.has(read.claim)) {
                findings.push({ file: file.path, line, detail: `reads the claim ${read.claim}, which the core does not declare` });
                continue;
              }
              const owners = roleClaims.get(read.claim);
              const inside = enclosingFunction(functions, read.index);
              if (owners && !(inside && owners.has(inside.name))) {
                findings.push({ file: file.path, line, detail: `reads the role claim ${read.claim} outside its role helper (${[...owners].join(', ')}), skipping the roster` });
              }
            }
            for (const helper of helpers) {
              const fn = functions.get(helper.function);
              if (!fn) continue;
              declaredSomewhere.add(helper.function);
              for (const detail of roleHelperProblems(expandedBody(helper.function, functions), helper, rosterPath)) {
                findings.push({ file: file.path, line: file.lineOf(fn.index), detail });
              }
            }
          }
          for (const h of helpers) {
            if (!declaredSomewhere.has(h.function)) findings.push({ file: '(config)', detail: `no listed rules file declares the role helper ${h.function}()` });
          }
          return findings;
        },
      },
    ];
  },
};
