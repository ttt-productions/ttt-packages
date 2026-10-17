// The env files a deploy copies into a runtime (a committed `temp.env.*` CI copies into the Functions
// `.env`) carry public values only: every key is a declared public key, and no value is shaped like a
// credential. A secret is bound from the secret manager, never written into a committed env file.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding } from '../../guard.js';
import { namesProblem, reviewedProblems } from '../../support/facts.js';

export interface EnvPublicValuesFacts {
  /** The committed env files a deploy delivers, repo-relative. */
  files: readonly string[];
  /** The keys those files may hold, each with why its value is public. */
  publicKeys: ReadonlyArray<{ key: string; why: string }>;
}

/** Shapes no public value takes: a PEM key, a service-account field, and providers' token prefixes. */
export const CREDENTIAL_SHAPES: readonly RegExp[] = Object.freeze([
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /"?private_key(?:_id)?"?\s*[:=]/,
  /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]+/,
  /\bwhsec_[0-9A-Za-z]+/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:ghp|gho|ghs|ghu)_[0-9A-Za-z]{20,}/,
  /\bgithub_pat_[0-9A-Za-z_]{20,}/,
  /\bxox[abprs]-[0-9A-Za-z-]+/,
  /\bsntry[su]_[0-9A-Za-z_=+/.-]+/,
  /\bya29\.[0-9A-Za-z_-]+/,
]);

const ASSIGNMENT = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/;

/** Each offending line of one env file, named by file, line, and key — never by its value. */
export function envOffenders(file: string, text: string, publicKeys: ReadonlySet<string>, seen?: Set<string>): Finding[] {
  const findings: Finding[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const assignment = ASSIGNMENT.exec(line);
    if (!assignment) {
      findings.push({ file, line: index + 1, detail: 'not a KEY=value line' });
      return;
    }
    const [, key, value] = assignment;
    seen?.add(key);
    if (!publicKeys.has(key)) findings.push({ file, line: index + 1, detail: `${key} is not a declared public key` });
    if (CREDENTIAL_SHAPES.some((shape) => shape.test(value))) findings.push({ file, line: index + 1, detail: `${key} holds a value shaped like a credential` });
  });
  return findings;
}

export const envPublicValuesGuard: GenericGuardDefinition<EnvPublicValuesFacts> = {
  id: 'envPublicValues',
  absentWhen: 'the app commits no env file a deploy delivers',
  factProblems(facts) {
    const problems: string[] = [];
    namesProblem(facts?.files, 'files', problems);
    reviewedProblems(facts?.publicKeys, 'publicKeys', problems, { key: 'key', nonEmpty: true });
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'the env files a deploy delivers carry public values only',
        description:
          `${facts.files.join(', ')} are copied into a runtime at deploy, in plain text: every key is a declared public key and ` +
          'no value is shaped like a credential. Bind a secret from the secret manager instead; a new public key is declared ' +
          'with why its value is public. A declared key no file holds any more is stale.',
        run(context) {
          const publicKeys = new Set(facts.publicKeys.map((p) => p.key));
          const seen = new Set<string>();
          const findings: Finding[] = [];
          for (const file of facts.files) findings.push(...envOffenders(file, context.file(file).text, publicKeys, seen));
          for (const { key } of facts.publicKeys) {
            if (!seen.has(key)) findings.push({ file: '(publicKeys)', detail: `stale public key: no env file holds ${key}` });
          }
          return findings;
        },
      },
    ];
  },
};
