import { afterAll, describe, expect, it } from 'vitest';
import {
  packageImportCyclesGuard,
  packageImportsGuard,
} from '../../src/modules/import-paths/package-imports.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';

const repos: TempRepo[] = [];
afterAll(() => repos.forEach((r) => r.remove()));

const ENTRIES = { '.': 'index', './schemas': 'schemas/index' };

const manifest = (entries: Record<string, string>) =>
  JSON.stringify({
    name: '@acme/kit',
    type: 'module',
    exports: Object.fromEntries(
      Object.entries(entries).map(([key, dist]) => [
        key,
        { types: `./dist/${dist}.d.ts`, default: `./dist/${dist}.js` },
      ]),
    ),
  });

function packageRepo(files: Record<string, string>, entries: Record<string, string> = ENTRIES) {
  const all: Record<string, string> = {
    'scripts/anchor.ts': 'export {};',
    'packages/kit/package.json': manifest(entries),
  };
  for (const [path, text] of Object.entries(files)) all[`packages/kit/${path}`] = text;
  const repo = tempRepo(all);
  repos.push(repo);
  return createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: '.', anchor: 'scripts/anchor.ts' } },
  });
}

const CLEAN = {
  'src/index.ts':
    "export { version } from './version.js';\nexport { format } from './text/format.js';",
  'src/version.ts': 'export const version = 1;',
  'src/text/format.ts':
    "import { version } from '../version.js';\nexport const format = () => String(version);",
  'src/schemas/index.ts': "export { UserSchema } from './user.js';",
  'src/schemas/user.ts':
    "import { format } from '../text/format.js';\nexport const UserSchema = format();",
  '__tests__/format.test.ts': "import { format } from '../src/text/format.js';\nformat();",
};

const runImports = async (files: Record<string, string>, entries?: Record<string, string>) => {
  const [guard] = packageImportsGuard.build({ packagesFolder: 'packages' });
  const findings = await guard.run(contextOf(packageRepo(files, entries)));
  return findings.map((f) => `${f.file} — ${f.detail}`);
};

describe('imports inside a package', () => {
  it('pass when every module imports the defining file and each entry index forwards its own files directly', async () => {
    expect(await runImports(CLEAN)).toEqual([]);
  });

  it('pass an entry-surface test importing an entry index to prove it forwards a name', async () => {
    const files = {
      ...CLEAN,
      '__tests__/schemas.entry.test.ts':
        "import { UserSchema } from '../src/schemas/index.js';\nUserSchema;",
    };
    expect(await runImports(files)).toEqual([]);
  });

  it("pass a test loading a fixture package's index, which models another package's entry", async () => {
    const files = {
      ...CLEAN,
      '__tests__/fixture-core/index.ts': 'export const fixture = 1;',
      '__tests__/fixture.test.ts': "import { fixture } from './fixture-core/index.js';\nfixture;",
    };
    expect(await runImports(files)).toEqual([]);
  });

  it('FLAG source importing a folder entry index instead of the defining file', async () => {
    const files = {
      ...CLEAN,
      'src/text/format.ts':
        "import { UserSchema } from '../schemas/index.js';\nexport const format = () => String(UserSchema);",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/src/text/format.ts — import through index: imports '../schemas/index.js', an index — import the file that defines each name",
    ]);
  });

  it('FLAG source importing a folder by its name, which resolves to its index', async () => {
    const files = {
      ...CLEAN,
      'src/text/format.ts':
        "import { UserSchema } from '../schemas';\nexport const format = () => String(UserSchema);",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/src/text/format.ts — relative import without extension: imports '../schemas' — a relative import names its file with its built extension: '../schemas/index.js'",
      "packages/kit/src/text/format.ts — import through index: imports '../schemas', an index — import the file that defines each name",
    ]);
  });

  it("FLAG source importing the package's own name", async () => {
    const files = {
      ...CLEAN,
      'src/schemas/user.ts':
        "import { format } from '@acme/kit';\nexport const UserSchema = format();",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/src/schemas/user.ts — import own package name: imports '@acme/kit', the package's own name — import the file that defines each name",
    ]);
  });

  it('FLAG an ordinary test importing the root entry index to reach a function', async () => {
    const files = {
      ...CLEAN,
      '__tests__/format.test.ts': "import { format } from '../src/index.js';\nformat();",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/__tests__/format.test.ts — import through index: imports '../src/index.js', an index — import the file that defines each name",
    ]);
  });

  it('FLAG a test mocking an index, a path no module imports', async () => {
    const files = {
      ...CLEAN,
      '__tests__/format.test.ts':
        "import { vi } from 'vitest';\nvi.mock('../src/schemas/index.js');",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/__tests__/format.test.ts — import through index: imports '../src/schemas/index.js', an index — import the file that defines each name",
    ]);
  });

  it('FLAG an entry index that declares a definition of its own instead of forwarding a named file', async () => {
    const files = {
      ...CLEAN,
      'src/schemas/index.ts':
        "export { UserSchema } from './user.js';\nexport const SCHEMA_VERSION = 2;",
    };
    expect(await runImports(files)).toEqual([
      'packages/kit/src/schemas/index.ts — index declares: declares SCHEMA_VERSION — an index only forwards; move each definition into a named file and forward that file',
    ]);
  });

  it('FLAG an index that is not a package entry', async () => {
    const files = { ...CLEAN, 'src/text/index.ts': "export { format } from './format.js';" };
    expect(await runImports(files)).toEqual([
      'packages/kit/src/text/index.ts — non entry index: an index that is not a package entry — delete it and import the files it forwarded directly',
    ]);
  });

  it('FLAG a module that is not an entry index re-exporting, in the one-statement and two-statement forms', async () => {
    const files = {
      ...CLEAN,
      'src/text/format.ts':
        "import { version } from '../version.js';\nexport { version };\nexport const format = () => String(version);",
      'src/schemas/user.ts':
        "export { format } from '../text/format.js';\nexport const UserSchema = 1;",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/src/schemas/user.ts — reexport outside entry: named re-export of format from '../text/format.js' — only an entry index re-exports",
      "packages/kit/src/text/format.ts — reexport outside entry: two-statement re-export of version from '../version.js' — only an entry index re-exports",
    ]);
  });

  it('FLAG an entry index forwarding a file outside its folder', async () => {
    const files = {
      ...CLEAN,
      'src/schemas/index.ts':
        "export { UserSchema } from './user.js';\nexport { format } from '../text/format.js';",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/src/schemas/index.ts — entry forwards outside folder: forwards format from '../text/format.js', which is outside packages/kit/src/schemas/",
    ]);
  });

  it('FLAG an entry index forwarding through another index instead of naming the defining file', async () => {
    const files = {
      ...CLEAN,
      'src/index.ts': "export { version } from './version.js';\nexport * from './text/index.js';",
      'src/text/index.ts': "export { format } from './format.js';",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/src/index.ts — entry forwards index: forwards * from './text/index.js', an index — name the file that defines it",
      'packages/kit/src/text/index.ts — non entry index: an index that is not a package entry — delete it and import the files it forwarded directly',
    ]);
  });

  it('FLAG a local import that resolves to no module, never reading it as clean', async () => {
    const files = {
      ...CLEAN,
      'src/version.ts': "import { gone } from './gone.js';\nexport const version = gone;",
    };
    expect(await runImports(files)).toEqual([
      "packages/kit/src/version.ts — unresolved import: './gone.js' names no module in the package (looked for packages/kit/src/gone.js)",
    ]);
  });

  it('require the packages folder', () => {
    expect(packageImportsGuard.factProblems({ packagesFolder: '' })).toEqual([
      'packagesFolder is missing',
    ]);
  });
});

const NO_EXTENSION = (file: string, spec: string, named: string) =>
  `packages/kit/${file} — relative import without extension: imports '${spec}' — a relative import names its file with its built extension: '${named}'`;

describe('relative imports inside a package name their file by its built extension', () => {
  it('FLAG an extensionless static import in source', async () => {
    const files = {
      ...CLEAN,
      'src/text/format.ts':
        "import { version } from '../version';\nexport const format = () => String(version);",
    };
    expect(await runImports(files)).toEqual([
      NO_EXTENSION('src/text/format.ts', '../version', '../version.js'),
    ]);
  });

  it('FLAG an extensionless export … from in an entry index', async () => {
    const files = { ...CLEAN, 'src/schemas/index.ts': "export { UserSchema } from './user';" };
    expect(await runImports(files)).toEqual([
      NO_EXTENSION('src/schemas/index.ts', './user', './user.js'),
    ]);
  });

  it('FLAG an extensionless import()', async () => {
    const files = {
      ...CLEAN,
      'src/version.ts':
        "export const version = 1;\nexport const load = () => import('./text/format');",
    };
    expect(await runImports(files)).toEqual([
      NO_EXTENSION('src/version.ts', './text/format', './text/format.js'),
    ]);
  });

  it('FLAG an extensionless static import in a test', async () => {
    const files = {
      ...CLEAN,
      '__tests__/format.test.ts': "import { format } from '../src/text/format';\nformat();",
    };
    expect(await runImports(files)).toEqual([
      NO_EXTENSION('__tests__/format.test.ts', '../src/text/format', '../src/text/format.js'),
    ]);
  });

  it('FLAG an extensionless module mock and an extensionless vi.importActual in a test', async () => {
    const files = {
      ...CLEAN,
      '__tests__/format.test.ts':
        "import { vi } from 'vitest';\nvi.mock('../src/version');\nawait vi.importActual('../src/text/format');",
    };
    expect(await runImports(files)).toEqual([
      NO_EXTENSION('__tests__/format.test.ts', '../src/text/format', '../src/text/format.js'),
      NO_EXTENSION('__tests__/format.test.ts', '../src/version', '../src/version.js'),
    ]);
  });

  it('FLAG an extensionless import of a .tsx file, which is named .js', async () => {
    const files = {
      ...CLEAN,
      'src/text/badge.tsx': 'export const Badge = () => null;',
      'src/text/format.ts':
        "import { version } from '../version.js';\nimport { Badge } from './badge';\nexport const format = () => String(version) + String(Badge);",
    };
    expect(await runImports(files)).toEqual([
      NO_EXTENSION('src/text/format.ts', './badge', './badge.js'),
    ]);
  });

  it('FLAG a specifier naming the source extension instead of the built one', async () => {
    const files = {
      ...CLEAN,
      'src/text/format.ts':
        "import { version } from '../version.ts';\nexport const format = () => String(version);",
    };
    expect(await runImports(files)).toEqual([
      NO_EXTENSION('src/text/format.ts', '../version.ts', '../version.js'),
    ]);
  });

  it('pass .js, .json, and .css specifiers, a package specifier, and an import written inside a string', async () => {
    const files = {
      ...CLEAN,
      'src/text/format.ts': [
        "import { version } from '../version.js';",
        "import data from '../data.json';",
        "import '../styles/kit.css';",
        "import { z } from 'zod';",
        'export const FIXTURE = "import { gone } from \'./gone\';";',
        'export const format = () => String(version) + String(data) + String(z);',
      ].join('\n'),
    };
    expect(await runImports(files)).toEqual([]);
  });
});

const runCycles = async (files: Record<string, string>) => {
  const [guard] = packageImportCyclesGuard.build({ packagesFolder: 'packages' });
  const findings = await guard.run(contextOf(packageRepo(files)));
  return findings.map((f) => `${f.file} — ${f.detail}`);
};

const A = 'packages/kit/src/a.ts';
const B = 'packages/kit/src/b.ts';

describe('runtime import cycles inside a package', () => {
  it('pass a package whose runtime imports form no cycle', async () => {
    expect(await runCycles(CLEAN)).toEqual([]);
  });

  it('FLAG two modules that import each other at run time, naming the closed path', async () => {
    const files = {
      ...CLEAN,
      'src/a.ts': "import { b } from './b.js';\nexport const a = () => b;",
      'src/b.ts': "import { a } from './a.js';\nexport const b = () => a;",
    };
    expect(await runCycles(files)).toEqual([`${A} — runtime import cycle: ${A} → ${B} → ${A}`]);
  });

  it('FLAG a cycle closed by an entry forwarding a module that imports the entry', async () => {
    const files = {
      ...CLEAN,
      'src/version.ts': "import { format } from './index.js';\nexport const version = format;",
    };
    expect(await runCycles(files)).toEqual([
      'packages/kit/src/index.ts — runtime import cycle: packages/kit/src/index.ts → packages/kit/src/version.ts → packages/kit/src/index.ts',
    ]);
  });

  it('pass a cycle made only of type-only imports, which the build erases', async () => {
    const files = {
      ...CLEAN,
      'src/a.ts': "import type { B } from './b.js';\nexport type A = { b?: B };",
      'src/b.ts': "import { type A } from './a.js';\nexport type B = { a?: A };",
    };
    expect(await runCycles(files)).toEqual([]);
  });

  it('pass a cycle closed by an import whose bindings are read only as types', async () => {
    const files = {
      ...CLEAN,
      'src/a.ts': "import { b } from './b.js';\nexport const a = () => b;",
      'src/b.ts': "import { a } from './a.js';\nexport const b = 1;\nexport type UsesA = typeof a;",
    };
    expect(await runCycles(files)).toEqual([]);
  });

  it.each([
    ['a statement label', 'a: for (const x of [1]) void x;'],
    ['a break label', 'a: for (const x of [1]) { if (x) break a; }'],
    ['a continue label', 'a: for (const x of [1]) { if (x) continue a; }'],
  ])(
    'pass a cycle closed by an import whose name appears only as %s, which reads no value',
    async (_form, labelled) => {
      const files = {
        ...CLEAN,
        'src/a.ts': "import { b } from './b.js';\nexport const a = () => b;",
        'src/b.ts': `import { a } from './a.js';\nexport type UsesA = typeof a;\nexport const b = () => {\n  ${labelled}\n};`,
      };
      expect(await runCycles(files)).toEqual([]);
    },
  );

  it('pass a cycle closed only by a lazy import(), which never runs while a module evaluates', async () => {
    const files = {
      ...CLEAN,
      'src/a.ts': "import { b } from './b.js';\nexport const a = () => b;",
      'src/b.ts': "export const b = () => import('./a.js');",
    };
    expect(await runCycles(files)).toEqual([]);
  });

  it('pass a cycle among test files, which are not part of the package', async () => {
    const files = {
      ...CLEAN,
      '__tests__/a.ts': "import { b } from './b.js';\nexport const a = b;",
      '__tests__/b.ts': "import { a } from './a.js';\nexport const b = a;",
    };
    expect(await runCycles(files)).toEqual([]);
  });
});
