import { afterAll, describe, expect, it } from 'vitest';
import { applicationDataImportsGuard } from '../../src/modules/import-paths/application-data.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const repos: TempRepo[] = [];
afterAll(() => repos.forEach((r) => r.remove()));

const manifest = (
  name: string,
  dependencies: Record<string, string> = {},
  field = 'dependencies',
) => JSON.stringify({ name, type: 'module', [field]: dependencies });

const CLEAN: Record<string, string> = {
  'packages/kit/package.json': manifest('@acme/kit'),
  'packages/kit/src/format.ts': 'export const format = (v: string) => v;',
  'packages/app-core/package.json': manifest('@acme/app-core', { '@acme/kit': '*' }),
  'packages/app-core/src/names.ts':
    "import { format } from '@acme/kit';\nexport const name = format('a');",
};

function repoOf(files: Record<string, string>) {
  const repo = tempRepo({ 'scripts/anchor.ts': 'export {};', ...files });
  repos.push(repo);
  return createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: '.', anchor: 'scripts/anchor.ts' } },
  });
}

const run = async (
  files: Record<string, string>,
  applicationDataPackages: string[] = ['app-core'],
) => {
  const [guard] = applicationDataImportsGuard.build({
    packagesFolder: 'packages',
    applicationDataPackages,
  });
  const findings = await guard.run(contextOf(repoOf(files)));
  return findings.map((f) => `${f.file}${f.line ? `:${f.line}` : ''} — ${f.detail}`);
};

describe('generic packages and application-data packages', () => {
  it('pass an application-data package depending on a generic package', async () => {
    expect(await run(CLEAN)).toEqual([]);
  });

  it('FLAG a generic package importing an application-data package, a subpath included', async () => {
    const files = {
      ...CLEAN,
      'packages/kit/src/format.ts':
        "import { name } from '@acme/app-core/names';\nexport const format = () => name;",
    };
    expect(await run(files)).toEqual([
      "packages/kit/src/format.ts:1 — imports '@acme/app-core/names' from the application-data package @acme/app-core",
    ]);
  });

  it("FLAG a generic package's test importing an application-data package", async () => {
    const files = {
      ...CLEAN,
      'packages/kit/__tests__/format.test.ts': "import { name } from '@acme/app-core';\nname;",
    };
    expect(await run(files)).toEqual([
      "packages/kit/__tests__/format.test.ts:1 — imports '@acme/app-core' from the application-data package @acme/app-core",
    ]);
  });

  it('FLAG a generic package declaring an application-data package, as a dev or peer dependency too', async () => {
    const files = {
      ...CLEAN,
      'packages/kit/package.json': manifest(
        '@acme/kit',
        { '@acme/app-core': '*' },
        'peerDependencies',
      ),
    };
    expect(await run(files)).toEqual([
      'packages/kit/package.json — peerDependencies names the application-data package @acme/app-core',
    ]);
  });

  it('FLAG a declared application-data folder that holds no package', async () => {
    expect(await run(CLEAN, ['app-core', 'gone-core'])).toEqual([
      'packages/gone-core — applicationDataPackages names a folder that holds no package',
    ]);
  });

  it('require the packages folder and at least one application-data package', () => {
    expect(
      applicationDataImportsGuard.factProblems({ packagesFolder: '', applicationDataPackages: [] }),
    ).toEqual(['packagesFolder is missing', 'applicationDataPackages is missing']);
  });
});
