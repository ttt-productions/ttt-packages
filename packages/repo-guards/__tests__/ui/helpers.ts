import type { GenericGuardDefinition } from '../../src/node/suite/config.js';
import type { Finding } from '../../src/guard.js';
import type { RepoLayout } from '../../src/node/layout.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo } from '../helpers/temp-repo.js';

const ANCHOR = 'src/anchor.ts';

export const show = (f: Finding) => `${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`;

export async function runDefinition<F>(
  definition: GenericGuardDefinition<F>,
  facts: F,
  files: Record<string, string>,
  roots: Partial<RepoLayout['roots']> = {},
): Promise<Record<string, string[]>> {
  const repo = tempRepo({ [ANCHOR]: 'export {};', ...files });
  try {
    const reader = createRepoReader({
      repoRoot: repo.root,
      roots: { app: { path: 'src', anchor: ANCHOR }, ...roots },
    });
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

export async function allFindings<F>(
  definition: GenericGuardDefinition<F>,
  facts: F,
  files: Record<string, string>,
  roots: Partial<RepoLayout['roots']> = {},
): Promise<string[]> {
  return Object.values(await runDefinition(definition, facts, files, roots)).flat();
}

export function installed(
  name: string,
  manifest: Record<string, unknown>,
  files: Record<string, string> = {},
): Record<string, string> {
  const out: Record<string, string> = {
    [`node_modules/${name}/package.json`]: JSON.stringify({ name, ...manifest }),
  };
  for (const [rel, text] of Object.entries(files)) out[`node_modules/${name}/${rel}`] = text;
  return out;
}
