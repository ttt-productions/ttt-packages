import { describe, it, expect } from 'vitest';
import {
  IMPORT_PATH_VIOLATION_KINDS,
  analyzeImportPaths,
  createImportPathProfile,
  findUnusedIndexMembers,
  formatImportPathReport,
} from '../../src/modules/import-paths/analyzer.js';

const PROFILE = createImportPathProfile({ importAliases: { '@/': 'src/' } });
const run = (files, { profile = PROFILE, roots = ['src', 'functions/src'] } = {}) =>
  analyzeImportPaths({ files: new Map(Object.entries(files)), roots, profile }).violations;
const kinds = (violations) => violations.map((v) => `${v.kind} ${v.file}`);

const KIT = {
  'src/kit/index.ts': `export { Button } from './button';\nexport type { ButtonProps } from './button';`,
  'src/kit/button.tsx': `export function Button() { return null; }\nexport type ButtonProps = { a: 1 };\nexport const HELPER = 1;`,
};

describe('createImportPathProfile', () => {
  it('refuses an exception with no justification', () => {
    expect(() =>
      createImportPathProfile({ exceptions: [{ file: 'functions/src/index.ts', why: ' ' }] }),
    ).toThrow(/carries no why/);
  });

  it('refuses an exception listed twice', () => {
    const e = { file: 'functions/src/index.ts', why: 'deploy manifest' };
    expect(() => createImportPathProfile({ exceptions: [e, e] })).toThrow(/twice/);
  });

  it('refuses an alias with no target folder', () => {
    expect(() => createImportPathProfile({ importAliases: { '@/': undefined } })).toThrow(/target/);
  });
});

describe('a module that is not a folder index never re-exports', () => {
  it('FLAGS every written form of a forward, values and types alike', () => {
    const violations = run({
      'src/lib/owner.ts': `export const a = 1;\nexport const b = 2;\nexport type T = string;\nexport default 3;`,
      'src/lib/named.ts': `export { a } from './owner';`,
      'src/lib/aliased.ts': `export { a as renamed } from './owner';`,
      'src/lib/star.ts': `export * from './owner';`,
      'src/lib/namespace.ts': `export * as ns from './owner';`,
      'src/lib/two-statement.ts': `import { b } from './owner';\nexport { b };`,
      'src/lib/type-only.ts': `export type { T } from './owner';`,
      'src/lib/type-two-statement.ts': `import type { T } from './owner';\nexport type { T };`,
      'src/lib/default.ts': `import d from './owner';\nexport default d;`,
      'src/lib/package.ts': `export { z } from 'zod';`,
    });
    expect(kinds(violations).sort()).toEqual([
      'reexport-outside-index src/lib/aliased.ts',
      'reexport-outside-index src/lib/default.ts',
      'reexport-outside-index src/lib/named.ts',
      'reexport-outside-index src/lib/namespace.ts',
      'reexport-outside-index src/lib/package.ts',
      'reexport-outside-index src/lib/star.ts',
      'reexport-outside-index src/lib/two-statement.ts',
      'reexport-outside-index src/lib/type-only.ts',
      'reexport-outside-index src/lib/type-two-statement.ts',
    ]);
  });

  it('does not flag a module exporting its own declarations, or a new binding built from an import', () => {
    expect(
      run({
        'src/lib/owner.ts': `export const a = 1;`,
        'src/lib/own.ts': `const local = 2;\nexport { local, local as alias };\nexport function f() {}\nexport class C {}`,
        'src/lib/derived.ts': `import { a } from './owner';\nexport const doubled = a * 2;`,
      }),
    ).toEqual([]);
  });
});

describe('a folder index forwards only modules inside its own subtree', () => {
  it('does not flag forwards from siblings and nested folders', () => {
    expect(
      run({
        ...KIT,
        'src/kit/nested/deep.ts': `export const deep = 1;`,
        'src/kit/index.ts': `export { Button } from './button';\nexport { deep } from './nested/deep';`,
      }),
    ).toEqual([]);
  });

  it('FLAGS a forward from outside the folder, by relative path or alias, and from a package', () => {
    const violations = run({
      'src/shared/motion.ts': `export const reduced = () => false;`,
      'src/kit/button.tsx': `export const Button = 1;`,
      'src/kit/index.ts': [
        `export { Button } from './button';`,
        `export { reduced } from '../shared/motion';`,
        `export { reduced as viaAlias } from '@/shared/motion';`,
        `export type { ZodType } from 'zod';`,
      ].join('\n'),
    });
    expect(violations.map((v) => v.kind)).toEqual([
      'index-forwards-outside-folder',
      'index-forwards-outside-folder',
      'index-forwards-outside-folder',
    ]);
    expect(violations.every((v) => v.file === 'src/kit/index.ts')).toBe(true);
  });
});

describe('outside code imports through a folder index, never past it', () => {
  it('does not flag an import through the index, or a direct import inside the folder', () => {
    expect(
      run({
        ...KIT,
        'src/app/page.tsx': `import { Button } from '@/kit';\nimport type { ButtonProps } from '../kit/index';`,
        'src/kit/user.tsx': `import { Button } from './button';`,
      }),
    ).toEqual([]);
  });

  it('FLAGS a production import past the index — static, type-only, side-effect, and dynamic', () => {
    const violations = run({
      ...KIT,
      'src/app/static.tsx': `import { HELPER } from '@/kit/button';`,
      'src/app/type-only.tsx': `import type { ButtonProps } from '../kit/button';`,
      'src/app/side-effect.tsx': `import '@/kit/button';`,
      'src/app/dynamic.tsx': `const m = await import('@/kit/button');`,
    });
    expect(kinds(violations).sort()).toEqual([
      'import-past-index src/app/dynamic.tsx',
      'import-past-index src/app/side-effect.tsx',
      'import-past-index src/app/static.tsx',
      'import-past-index src/app/type-only.tsx',
    ]);
  });

  it('resolves the emitted `.js` specifier of a TypeScript module', () => {
    const violations = run({
      'functions/src/audit/index.ts': `export { write } from './write.js';`,
      'functions/src/audit/write.ts': `export function write() {}`,
      'functions/src/users/x.ts': `import { write } from '../audit/write.js';`,
    });
    expect(kinds(violations)).toEqual(['import-past-index functions/src/users/x.ts']);
  });

  it('FLAGS an import of a nested folder that bypasses the outer index, naming the outer one', () => {
    const violations = run({
      'src/kit/index.ts': `export { Inner } from './inner';`,
      'src/kit/inner/index.ts': `export { Inner } from './inner';`,
      'src/kit/inner/inner.tsx': `export const Inner = 1;`,
      'src/app/page.tsx': `import { Inner } from '@/kit/inner';`,
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ kind: 'import-past-index', file: 'src/app/page.tsx' });
    expect(violations[0].detail).toContain('past src/kit/index.ts');
  });

  it('FLAGS an index forward that reaches past a nested folder index', () => {
    const violations = run({
      'src/kit/index.ts': `export { Inner } from './inner/inner';`,
      'src/kit/inner/index.ts': `export { Inner } from './inner';`,
      'src/kit/inner/inner.tsx': `export const Inner = 1;`,
    });
    expect(kinds(violations)).toEqual(['import-past-index src/kit/index.ts']);
  });

  describe('tests', () => {
    it('may import an internal module for names the index does not forward', () => {
      expect(
        run({
          ...KIT,
          'src/__tests__/button.test.tsx': `import { HELPER } from '@/kit/button';`,
          'functions/src/other/x.test.ts': `const { HELPER } = await import('../../../src/kit/button');`,
        }),
      ).toEqual([]);
    });

    it('FLAGS a test importing past the index a name the index forwards, by value, type, or namespace', () => {
      const violations = run({
        ...KIT,
        'src/__tests__/a.test.tsx': `import { Button } from '@/kit/button';`,
        'src/__tests__/b.test.tsx': `import type { ButtonProps } from '@/kit/button';`,
        'src/__tests__/c.test.tsx': `import * as all from '@/kit/button';`,
        'src/__tests__/d.test.tsx': `const { Button } = await import('@/kit/button');`,
      });
      expect(kinds(violations).sort()).toEqual([
        'import-past-index src/__tests__/a.test.tsx',
        'import-past-index src/__tests__/b.test.tsx',
        'import-past-index src/__tests__/c.test.tsx',
        'import-past-index src/__tests__/d.test.tsx',
      ]);
    });

    it('treats a name star-forwarded by the index as forwarded', () => {
      const violations = run({
        'src/kit/index.ts': `export * from './button';`,
        'src/kit/button.tsx': `export const Button = 1;`,
        'src/__tests__/a.test.tsx': `import { Button } from '@/kit/button';`,
      });
      expect(kinds(violations)).toEqual(['import-past-index src/__tests__/a.test.tsx']);
    });

    it('never holds a module mock to the rule — it names the path the code under test imports', () => {
      expect(
        run({
          ...KIT,
          'src/__tests__/a.test.tsx': `vi.mock('@/kit/button', () => ({ Button: () => null }));\nvi.importActual('@/kit/button');`,
        }),
      ).toEqual([]);
    });

    it('still FLAGS a production module that calls vi.mock-shaped code past the index', () => {
      const violations = run({ ...KIT, 'src/app/odd.ts': `vi.mock('@/kit/button');` });
      expect(kinds(violations)).toEqual(['import-past-index src/app/odd.ts']);
    });
  });
});

describe('code inside a folder never imports the index of a folder that contains it', () => {
  it('FLAGS a module importing its own folder index or an ancestor index', () => {
    const violations = run({
      ...KIT,
      'src/kit/user.tsx': `import { Button } from './index';`,
      'src/kit/page/card.tsx': `import { Button } from '@/kit';`,
    });
    expect(kinds(violations).sort()).toEqual([
      'import-through-own-index src/kit/page/card.tsx',
      'import-through-own-index src/kit/user.tsx',
    ]);
  });

  it('does not flag a module importing a NESTED folder through that nested index', () => {
    expect(
      run({
        'src/kit/index.ts': `export { Inner } from './inner';`,
        'src/kit/inner/index.ts': `export { Inner } from './inner';`,
        'src/kit/inner/inner.tsx': `export const Inner = 1;`,
        'src/kit/user.tsx': `import { Inner } from './inner';`,
      }),
    ).toEqual([]);
  });
});

describe('exceptions', () => {
  const MANIFEST = {
    file: 'functions/src/index.ts',
    why: 'deploy manifest — the deploy tool reads every exported function from it',
  };
  const profile = createImportPathProfile({ exceptions: [MANIFEST] });

  it('lets the excepted module re-export, and does not make it a folder entry point', () => {
    expect(
      run(
        {
          'functions/src/index.ts': `export { fn } from './users/fn.js';\nexport { other } from '@scope/pkg';`,
          'functions/src/users/fn.ts': `export const fn = 1;`,
          'src/__tests__/x.test.ts': `import { fn } from '../../functions/src/users/fn';`,
        },
        { profile },
      ),
    ).toEqual([]);
  });

  it('FLAGS an exception whose module is gone, and one that no longer re-exports', () => {
    expect(
      kinds(run({ 'functions/src/users/fn.ts': `export const fn = 1;` }, { profile })),
    ).toEqual(['stale-exception functions/src/index.ts']);
    expect(kinds(run({ 'functions/src/index.ts': `export const fn = 1;` }, { profile }))).toEqual([
      'stale-exception functions/src/index.ts',
    ]);
  });
});

describe('unresolved imports fail closed', () => {
  it('FLAGS a local specifier under an analyzed root that names no module, mocks included', () => {
    const violations = run({
      'src/__tests__/a.test.ts': `vi.mock('@/lib/gone', () => ({}));`,
      'src/app/b.ts': `import { x } from './missing';`,
    });
    expect(kinds(violations).sort()).toEqual([
      'unresolved-import src/__tests__/a.test.ts',
      'unresolved-import src/app/b.ts',
    ]);
  });

  it('does not judge a package, an asset, or a path outside the analyzed roots', () => {
    expect(
      run({
        'src/app/a.tsx': [
          `import { z } from 'zod';`,
          `import './styles.css';`,
          `import data from './data.json';`,
          `import { x } from '../../scripts/tool.mjs';`,
        ].join('\n'),
      }),
    ).toEqual([]);
  });

  it('resolves a module the profile says exists inside an excluded path, and still flags a missing one', () => {
    const profile = createImportPathProfile({
      importAliases: { '@/': 'src/' },
      isExcludedModule: (p) => p === 'src/config/facts.ts',
    });
    const violations = run(
      {
        'src/__tests__/a.test.ts': [
          `import { facts } from '../config/facts.ts';`,
          `import { more } from '@/config/facts';`,
          `import { gone } from '../config/gone.ts';`,
        ].join('\n'),
      },
      { profile },
    );
    expect(violations.map((v) => `${v.kind} ${v.detail}`)).toEqual([
      "unresolved-import '../config/gone.ts' names no module under the analyzed trees (looked for src/config/gone.ts)",
    ]);
  });
});

describe('findUnusedIndexMembers (report-only)', () => {
  const unused = (files) =>
    findUnusedIndexMembers({
      files: new Map(Object.entries(files)),
      roots: ['src'],
      profile: PROFILE,
    });

  it('lists index members nothing outside the folder imports, ignoring inside imports and mocks', () => {
    expect(
      unused({
        ...KIT,
        'src/app/page.tsx': `import { Button } from '@/kit';`,
        'src/kit/user.tsx': `import type { ButtonProps } from './button';`,
        'src/__tests__/a.test.tsx': `vi.mock('@/kit', () => ({}));`,
      }),
    ).toEqual([{ file: 'src/kit/index.ts', unused: ['ButtonProps'] }]);
  });

  it('counts a namespace import of the index as using every member', () => {
    expect(unused({ ...KIT, 'src/app/page.tsx': `import * as kit from '@/kit';` })).toEqual([]);
  });

  it('is not a violation — the guard itself stays clean on the same set', () => {
    expect(run(KIT)).toEqual([]);
  });
});

describe('formatImportPathReport', () => {
  it('says clean when there is nothing to report', () => {
    expect(formatImportPathReport({ violations: [] })).toMatch(/clean/);
  });

  it('lists every violation with its kind, file, and detail', () => {
    const text = formatImportPathReport({
      violations: [
        { kind: 'reexport-outside-index', file: 'src/a.ts', detail: 'named re-export of a' },
      ],
    });
    expect(text).toContain('1 violation');
    expect(text).toContain('[reexport-outside-index] src/a.ts — named re-export of a');
  });

  it('names a fixed set of kinds', () => {
    expect(IMPORT_PATH_VIOLATION_KINDS).toContain('import-past-index');
  });
});
