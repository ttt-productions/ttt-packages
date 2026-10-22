import type { GenericGuardDefinition } from '../../src/node/suite/config.js';
import { createRepoReader } from '../../src/node/reader.js';
import type { RepoLayout } from '../../src/node/layout.js';
import { checkSamples } from '../../src/node/suite/run.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo } from '../helpers/temp-repo.js';

export async function findingsOf<F>(
  definition: GenericGuardDefinition<F>,
  facts: F,
  files: Record<string, string>,
  roots: Partial<RepoLayout['roots']> = {},
): Promise<string[]> {
  const repo = tempRepo({ 'src/anchor.ts': 'export const anchor = 1;', ...files });
  try {
    const functions = Object.keys(files).some((p) => p.startsWith('functions/src/'));
    const reader = createRepoReader({
      repoRoot: repo.root,
      roots: {
        app: { path: 'src', anchor: 'src/anchor.ts' },
        ...(functions
          ? {
              functions: {
                path: 'functions/src',
                anchor: Object.keys(files).find((p) => p.startsWith('functions/src/'))!,
              },
            }
          : {}),
        ...roots,
      },
    });
    const out: string[] = [];
    for (const guard of definition.build(facts)) {
      await guard.prepare?.();
      for (const f of await guard.run(contextOf(reader)))
        out.push(`${f.file}${f.line ? `:${f.line}` : ''} ${f.detail}`);
    }
    return out;
  } finally {
    repo.remove();
  }
}

export function samplesProve<F>(definition: GenericGuardDefinition<F>, facts: F) {
  for (const guard of definition.build(facts)) checkSamples(guard);
}
