// Runs one of this area's guard definitions over a throwaway repository: the app root is `src`, a
// Functions root `functions/src` is declared when the files hold one, and `src/test` is test code.

import type { GenericGuardDefinition } from '../../src/node/suite/config.js';
import type { Finding } from '../../src/guard.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo } from '../helpers/temp-repo.js';

const ANCHOR = 'src/anchor.ts';
const FUNCTIONS_ANCHOR = 'functions/src/anchor.ts';

/** The findings of each guard the definition builds from `facts`, in build order. */
export async function runDefinition<F>(definition: GenericGuardDefinition<F>, facts: F, files: Record<string, string>): Promise<Finding[][]> {
  const problems = definition.factProblems(facts);
  if (problems.length) throw new Error(`facts refused: ${problems.join('; ')}`);
  const withFunctions = Object.keys(files).some((p) => p.startsWith('functions/src/'));
  const repo = tempRepo({ [ANCHOR]: 'export {};', ...(withFunctions ? { [FUNCTIONS_ANCHOR]: 'export {};' } : {}), ...files });
  try {
    const reader = createRepoReader({
      repoRoot: repo.root,
      roots: {
        app: { path: 'src', anchor: ANCHOR },
        ...(withFunctions ? { functions: { path: 'functions/src', anchor: FUNCTIONS_ANCHOR } } : {}),
      },
      ...(files['src/test/setup.ts'] !== undefined ? { testCodePaths: [{ path: 'src/test', why: 'test setup' }] } : {}),
    });
    const out: Finding[][] = [];
    for (const guard of definition.build(facts)) {
      await guard.prepare?.();
      out.push(await guard.run(contextOf(reader)));
    }
    return out;
  } finally {
    repo.remove();
  }
}

/** The findings of a definition that builds one guard. */
export async function runOne<F>(definition: GenericGuardDefinition<F>, facts: F, files: Record<string, string>): Promise<Finding[]> {
  const [findings] = await runDefinition(definition, facts, files);
  return findings;
}
