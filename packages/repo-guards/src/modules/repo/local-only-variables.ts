// Environment variables that exist only for a local or emulator run — an emulator switch, a debug
// token — never reach a deployed environment's configuration, and each is read in the app's source
// only by its one owner module, where it is gated. A deployed config naming one switches a local
// relaxation on in production; a second reader is a second gate that drifts from the first.
//
// This covers the repository's own config only: a value set in a hosting console can carry any name
// and override the repository's files, which no check over the repository can see.

import type { GenericGuardDefinition } from '../../config.js';
import type { Finding, Guard } from '../../guard.js';
import { ownerOnly } from '../../shapes/shapes.js';

export interface LocalOnlyVariablesFacts {
  /** Deployed environments' config files, repo-relative (each must exist). */
  deployedConfigs: readonly string[];
  /** Variable names no deployed config may name, each with why it is local-only. */
  neverDeployed: ReadonlyArray<{ name: string; why: string }>;
  /** The one app module that reads each set of variables, with why it owns them. */
  readers: ReadonlyArray<{ owner: string; names: readonly string[]; why: string }>;
}

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A config's text with every whole-line `#` comment removed — what the deployment declares. A
 * trailing comment stays: a mention there is read as a declaration, never guessed away.
 */
export function declarationsOf(text: string): string {
  return text
    .split('\n')
    .map((line) => (/^\s*#/.test(line) ? '' : line))
    .join('\n');
}

/** Each place a declared config names one of the variables, by line. */
export function deployedMentions(text: string, names: readonly string[]): Array<{ name: string; line: number }> {
  const lines = declarationsOf(text).split('\n');
  const out: Array<{ name: string; line: number }> = [];
  lines.forEach((line, index) => {
    for (const name of names) if (new RegExp(`\\b${escape(name)}\\b`).test(line)) out.push({ name, line: index + 1 });
  });
  return out;
}

function readerGuard(entry: LocalOnlyVariablesFacts['readers'][number]): Guard {
  const pattern = new RegExp(`\\b(?:${entry.names.map(escape).join('|')})\\b`, 'g');
  const [first] = entry.names;
  return ownerOnly({
    title: `only ${entry.owner} reads ${entry.names.join(', ')}`,
    description:
      `${entry.names.join(', ')} ${entry.names.length === 1 ? 'is' : 'are'} read in the app's source only by ${entry.owner} ` +
      `(${entry.why}). A second reader is a second gate on a local-only variable. Derive from the owner's export instead.`,
    scope: { roots: ['app'], kinds: ['code'], tests: false },
    match: (file) => [...file.code.matchAll(pattern)].map((m) => ({ index: m.index, detail: m[0] })),
    owners: [entry.owner],
    samples: {
      flags: [`const value = process.env.${first};`, `const value = process.env['${first}'];`],
      passes: [`// ${first} is read by its owner only`, `const value = process.env.X${first}X;`],
    },
  });
}

export const localOnlyVariablesGuard: GenericGuardDefinition<LocalOnlyVariablesFacts> = {
  id: 'localOnlyVariables',
  absentWhen: false,
  factProblems(facts) {
    const problems: string[] = [];
    if (!facts || typeof facts !== 'object') return ['the facts are missing'];
    if (!Array.isArray(facts.deployedConfigs) || !facts.deployedConfigs.length) problems.push('deployedConfigs names no deployed config file');
    if (!Array.isArray(facts.neverDeployed) || !facts.neverDeployed.length) problems.push('neverDeployed names no variable');
    else {
      for (const entry of facts.neverDeployed) {
        if (!entry?.name || !VARIABLE_NAME.test(entry.name)) problems.push(`neverDeployed holds an entry that names no variable (${String(entry?.name)})`);
        else if (!entry.why?.trim()) problems.push(`neverDeployed ${entry.name} carries no why`);
      }
    }
    if (!Array.isArray(facts.readers)) problems.push('readers is missing (an app with no owned variable declares [])');
    else {
      const owned = new Set<string>();
      for (const entry of facts.readers) {
        if (!entry?.owner) problems.push('a reader names no owner file');
        else if (!entry.why?.trim()) problems.push(`reader ${entry.owner} carries no why`);
        if (!Array.isArray(entry?.names) || !entry.names.length) problems.push(`reader ${entry?.owner} names no variable`);
        else {
          for (const name of entry.names) {
            if (!VARIABLE_NAME.test(name)) problems.push(`reader ${entry.owner} names ${name}, which is not a variable name`);
            if (owned.has(name)) problems.push(`${name} is given two owners`);
            owned.add(name);
          }
        }
      }
    }
    return problems;
  },
  build(facts) {
    const names = facts.neverDeployed.map((entry) => entry.name);
    const configGuard: Guard = {
      title: 'local-only variables never appear in deployed configuration',
      description:
        `${names.join(', ')} exist only for a local or emulator run and appear in no deployed config ` +
        `(${facts.deployedConfigs.join(', ')}) — not as a value, not as a secret reference. A deployed config naming one ` +
        'switches a local relaxation on, or publishes a debug value, in a real environment. Keep it in the local ' +
        'environment only; a mention in prose goes on its own # line.',
      run(context) {
        const findings: Finding[] = [];
        for (const config of facts.deployedConfigs) {
          if (!context.reader.exists(config)) {
            findings.push({ file: config, detail: 'the deployed config file does not exist' });
            continue;
          }
          for (const { name, line } of deployedMentions(context.file(config).text, names)) {
            findings.push({ file: config, line, detail: `names ${name}` });
          }
        }
        return findings;
      },
    };
    return [configGuard, ...facts.readers.map(readerGuard)];
  },
};
