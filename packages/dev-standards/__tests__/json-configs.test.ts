import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';

const packageDir = resolve(import.meta.dirname, '..');
const configDir = join(packageDir, 'config');

const appDir = mkdtempSync(join(tmpdir(), 'dev-standards-'));
mkdirSync(join(appDir, 'node_modules', '@ttt-productions'), { recursive: true });
symlinkSync(
  packageDir,
  join(appDir, 'node_modules', '@ttt-productions', 'dev-standards'),
  'junction',
);

afterAll(() => {
  rmSync(appDir, { recursive: true, force: true });
});

const NO_INPUTS = 18003;

function resolveTsconfig(folder: string, files: Record<string, unknown>, entry: string) {
  const dir = join(appDir, folder);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), JSON.stringify(content));
  }
  const errors: ts.Diagnostic[] = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(join(dir, entry), undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => errors.push(diagnostic),
  });
  const all = [...errors, ...(parsed?.errors ?? [])].filter((d) => d.code !== NO_INPUTS);
  expect(all.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  const { configFilePath: _path, ...options } = parsed!.options;
  return { options, compileOnSave: parsed!.compileOnSave };
}

const appInclude = ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'];
const appExclude = ['node_modules', '.next', 'functions', 'src/__tests__'];
const appPaths = { '@/*': ['./src/*'] };

const appTsconfigToday = {
  compilerOptions: {
    target: 'ES2017',
    lib: ['dom', 'dom.iterable', 'esnext'],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: 'react-jsx',
    incremental: false,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    forceConsistentCasingInFileNames: true,
    types: ['node'],
    plugins: [{ name: 'next' }],
    paths: appPaths,
  },
  include: appInclude,
  exclude: appExclude,
};

const functionsPaths = { outDir: 'lib', rootDir: 'src' };
const functionsInclude = ['src'];
const functionsExclude = ['node_modules', 'lib', '../src', '../.next', 'src/**/*.test.ts'];
const functionsTestTsconfig = {
  extends: './tsconfig.json',
  compilerOptions: { noEmit: true },
  include: ['src'],
  exclude: ['node_modules', 'lib', '../src', '../.next'],
};

const functionsTsconfigToday = {
  compilerOptions: {
    module: 'NodeNext',
    esModuleInterop: true,
    moduleResolution: 'nodenext',
    noImplicitReturns: true,
    noUnusedLocals: true,
    ...functionsPaths,
    sourceMap: true,
    strict: true,
    target: 'es2023',
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    isolatedModules: true,
  },
  compileOnSave: true,
  include: functionsInclude,
  exclude: functionsExclude,
};

describe('config/tsconfig.app.json', () => {
  it('resolves, extended by package specifier, to the options a self-contained app tsconfig sets', () => {
    const today = resolveTsconfig(
      'app-today',
      { 'tsconfig.json': appTsconfigToday },
      'tsconfig.json',
    );
    const converted = resolveTsconfig(
      'app-converted',
      {
        'tsconfig.json': {
          extends: '@ttt-productions/dev-standards/config/tsconfig.app.json',
          compilerOptions: { paths: appPaths },
          include: appInclude,
          exclude: appExclude,
        },
      },
      'tsconfig.json',
    );

    const { pathsBasePath: todayBase, ...todayOptions } = today.options;
    const { pathsBasePath: convertedBase, ...convertedOptions } = converted.options;
    expect(convertedOptions).toEqual(todayOptions);
    expect(convertedBase).toBe(join(appDir, 'app-converted').replaceAll('\\', '/'));
    expect(todayBase).toBe(join(appDir, 'app-today').replaceAll('\\', '/'));
  });
});

describe('config/tsconfig.functions.json', () => {
  const today = {
    'tsconfig.json': functionsTsconfigToday,
    'tsconfig.test.json': functionsTestTsconfig,
  };
  const converted = {
    'tsconfig.json': {
      extends: '@ttt-productions/dev-standards/config/tsconfig.functions.json',
      compilerOptions: functionsPaths,
      include: functionsInclude,
      exclude: functionsExclude,
    },
    'tsconfig.test.json': functionsTestTsconfig,
  };

  it.each(['tsconfig.json', 'tsconfig.test.json'])(
    'resolves %s, built on the base, to the options and compileOnSave it resolves to today',
    (entry) => {
      const was = resolveTsconfig('functions', today, entry);
      const now = resolveTsconfig('functions', converted, entry);
      expect(now.options).toEqual(was.options);
      expect(now.compileOnSave).toBe(true);
      expect(was.compileOnSave).toBe(true);
    },
  );
});

describe('the JSON bases', () => {
  const RELATIVE_PATH_OPTIONS = ['outDir', 'rootDir', 'baseUrl', 'paths', 'declarationDir'];

  it.each(['tsconfig.app.json', 'tsconfig.functions.json'])(
    '%s parses and holds no path, which would resolve inside node_modules',
    (file) => {
      const { config, error } = ts.readConfigFile(join(configDir, file), ts.sys.readFile);
      expect(error).toBeUndefined();
      expect(Object.keys(config).filter((key) => key !== 'compileOnSave')).toEqual([
        'compilerOptions',
      ]);
      for (const option of RELATIVE_PATH_OPTIONS) {
        expect(config.compilerOptions).not.toHaveProperty(option);
      }
    },
  );

  it('prettier.json is 100 columns and single quotes, Prettier defaults otherwise', () => {
    expect(JSON.parse(readFileSync(join(configDir, 'prettier.json'), 'utf8'))).toEqual({
      printWidth: 100,
      singleQuote: true,
    });
  });

  it('copies/components.json parses as JSON', () => {
    expect(() =>
      JSON.parse(readFileSync(join(configDir, 'copies', 'components.json'), 'utf8')),
    ).not.toThrow();
  });
});
