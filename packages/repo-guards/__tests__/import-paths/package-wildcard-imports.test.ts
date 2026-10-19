// No wildcard import of a scoped package: a consumer names each definition it uses, so every name
// is traced to the entry that owns it and a mock of one name cannot stand in for the whole module.

import { afterAll, describe, expect, it } from 'vitest';
import { packageWildcardImportsGuard } from '../../src/modules/import-paths/package-wildcard-imports.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const repos: TempRepo[] = [];
afterAll(() => repos.forEach((r) => r.remove()));

const run = async (app: Record<string, string>) => {
  const files: Record<string, string> = { 'src/page.ts': 'export {};' };
  for (const [path, text] of Object.entries(app)) files[`src/${path}`] = text;
  const repo = tempRepo(files);
  repos.push(repo);
  const reader = createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/page.ts' } },
  });
  const [guard] = packageWildcardImportsGuard.build({ scope: '@acme' });
  const findings = await guard.run(contextOf(reader));
  return findings.map((f) => `${f.file}:${f.line} — ${f.detail}`);
};

describe('wildcard imports of a scoped package', () => {
  it('pass named, default, type-only named, and side-effect imports, and wildcards of other modules', async () => {
    expect(
      await run({
        'page.ts': [
          "import { version } from '@acme/kit';",
          "import type { User } from '@acme/kit/schemas';",
          "import kit from '@acme/kit/legacy';",
          "import '@acme/kit/styles.css';",
          "import * as path from 'node:path';",
          "import * as local from './local.js';",
          "export * from './local.js';",
          "export { version as kitVersion } from '@acme/kit';",
        ].join('\n'),
        'local.ts': 'export const x = 1;',
      }),
    ).toEqual([]);
  });

  it('FLAG `import * as`, `import type * as`, `export * as`, and `export * from` a scoped package, in tests too', async () => {
    expect(
      await run({
        'page.ts': [
          "import * as Kit from '@acme/kit';",
          "import type * as Schemas from '@acme/kit/schemas';",
          "export * as react from '@acme/kit/react';",
          "export * from '@acme/kit/browser';",
        ].join('\n'),
        '__tests__/page.test.ts': "import * as KitMock from '@acme/kit';",
      }),
    ).toEqual([
      "src/__tests__/page.test.ts:1 — import * as KitMock from '@acme/kit' takes the whole module; import each name it uses",
      "src/page.ts:1 — import * as Kit from '@acme/kit' takes the whole module; import each name it uses",
      "src/page.ts:2 — import * as Schemas from '@acme/kit/schemas' takes the whole module; import each name it uses",
      "src/page.ts:3 — export * as react from '@acme/kit/react' takes the whole module; import each name it uses",
      "src/page.ts:4 — export * from '@acme/kit/browser' takes the whole module; import each name it uses",
    ]);
  });

  it('refuses a scope that is not an npm scope', () => {
    expect(packageWildcardImportsGuard.factProblems({ scope: 'acme' })).toEqual([
      'scope must be an npm scope such as @acme',
    ]);
  });
});
