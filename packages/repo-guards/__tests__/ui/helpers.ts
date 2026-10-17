// Running one UI guard definition over a throwaway repository, for the ui area's tests.

import type { GenericGuardDefinition } from '../../src/config.js';
import type { Finding } from '../../src/guard.js';
import type { RepoLayout } from '../../src/reader/layout.js';
import { createRepoReader } from '../../src/reader/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo } from '../helpers/temp-repo.js';

const ANCHOR = 'src/anchor.ts';

/** `file:line detail`, the shape every expectation below is written in. */
export const show = (f: Finding) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`;

/**
 * Every finding each guard the definition builds reports over a repository holding `files`
 * (beside an anchor file under `src`), keyed by guard title.
 */
export async function runDefinition<F>(
  definition: GenericGuardDefinition<F>,
  facts: F,
  files: Record<string, string>,
  roots: Partial<RepoLayout['roots']> = {},
): Promise<Record<string, string[]>> {
  const repo = tempRepo({ [ANCHOR]: 'export {};', ...files });
  try {
    const reader = createRepoReader({ repoRoot: repo.root, roots: { app: { path: 'src', anchor: ANCHOR }, ...roots } });
    const context = contextOf(reader);
    const out: Record<string, string[]> = {};
    for (const guard of definition.build(facts)) {
      await guard.prepare?.();
      out[guard.title] = (await guard.run(context)).map(show);
    }
    return out;
  } finally {
    repo.remove();
  }
}

/** Every finding of every guard the definition builds, in one list. */
export async function allFindings<F>(
  definition: GenericGuardDefinition<F>,
  facts: F,
  files: Record<string, string>,
  roots: Partial<RepoLayout['roots']> = {},
): Promise<string[]> {
  return Object.values(await runDefinition(definition, facts, files, roots)).flat();
}

/** A tiny installed package: its manifest and files under `node_modules/<name>/`. */
export function installed(name: string, manifest: Record<string, unknown>, files: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { [`node_modules/${name}/package.json`]: JSON.stringify({ name, ...manifest }) };
  for (const [rel, text] of Object.entries(files)) out[`node_modules/${name}/${rel}`] = text;
  return out;
}
