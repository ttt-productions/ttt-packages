import { createRequire } from 'node:module';
import js from '@eslint/js';
import { ESLint, type Linter } from 'eslint';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierCompat from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { createAppEslintConfig, createFunctionsEslintConfig } from '../src/node/eslint.js';

const zeroSuppression = { linterOptions: { noInlineConfig: true } };

// jsx-a11y is installed by eslint-config-next, not a direct dependency, so it is read from there.
const fromNext = createRequire(createRequire(import.meta.url).resolve('eslint-config-next'));
const jsxA11y = fromNext('eslint-plugin-jsx-a11y') as {
  configs: { recommended: { rules: Record<string, Linter.RuleEntry> } };
};

const a11yBlock = (severity: 'error' | 'warn'): Linter.Config => {
  const rules: Record<string, Linter.RuleEntry> = {};
  for (const [name, entry] of Object.entries(jsxA11y.configs.recommended.rules)) {
    const [level, ...ruleOptions] = Array.isArray(entry) ? entry : [entry];
    if (level === 'off') continue;
    rules[name] = ruleOptions.length > 0 ? [severity, ...ruleOptions] : severity;
  }
  return { files: ['**/*.tsx', '**/*.jsx'], rules };
};

const appScoped: Linter.Config = {
  files: ['src/**/*.ts'],
  rules: { 'no-restricted-syntax': ['error', { selector: 'DebuggerStatement', message: 'no' }] },
};

describe('createAppEslintConfig', () => {
  it('builds the Next.js app config with the app ignores and scoped configs in place', async () => {
    const config = await createAppEslintConfig({
      ignores: ['some-worker/**'],
      configs: [appScoped],
    });

    expect(config).toEqual([
      {
        ignores: [
          '.next/**',
          'node_modules/**',
          '.firebase/**',
          'functions/**',
          'e2e-hosted-dev/.browser-profiles/**',
          'e2e-hosted-dev/test-results/**',
          'e2e-hosted-dev/failed-run-archive/**',
          'test-results/**',
          'out/**',
          'dist/**',
          'build/**',
          'next-env.d.ts',
          '.next/types/**',
          '.next/dev/**',
          'docs/**',
          'some-worker/**',
        ],
      },
      zeroSuppression,
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...nextCoreWebVitals,
      ...nextTypescript,
      a11yBlock('error'),
      {
        files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
        languageOptions: {
          parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            ecmaFeatures: { jsx: true },
          },
        },
        rules: {
          '@next/next/no-img-element': 'off',
          '@typescript-eslint/no-unused-vars': [
            'error',
            {
              argsIgnorePattern: '^_',
              varsIgnorePattern: '^_',
              caughtErrorsIgnorePattern: '^_',
              destructuredArrayIgnorePattern: '^_',
            },
          ],
          'react-hooks/rules-of-hooks': 'error',
          'react-hooks/exhaustive-deps': 'error',
          'react-hooks/set-state-in-effect': 'error',
          'react-hooks/refs': 'error',
          'react-hooks/immutability': 'error',
          'react-hooks/incompatible-library': 'error',
          'react-hooks/purity': 'error',
        },
      },
      appScoped,
      prettierCompat,
    ]);
  });

  it('keeps eslint-config-prettier last when the app adds nothing', async () => {
    const config = await createAppEslintConfig();
    expect(config.at(-1)).toBe(prettierCompat);
    expect(config.at(-2)?.rules?.['react-hooks/purity']).toBe('error');
  });
});

describe('presets reject an explicit any', () => {
  const source = 'export const value: any = 1;\n';

  it('the app preset fails an explicit any', async () => {
    const eslint = new ESLint({
      cwd: import.meta.dirname,
      overrideConfigFile: true,
      overrideConfig: await createAppEslintConfig(),
    });
    const [result] = await eslint.lintText(source, { filePath: 'src/value.ts' });
    expect(result?.messages.map((m) => m.ruleId)).toContain('@typescript-eslint/no-explicit-any');
  });

  it('the Functions preset fails an explicit any', async () => {
    const eslint = new ESLint({
      cwd: import.meta.dirname,
      overrideConfigFile: true,
      overrideConfig: await createFunctionsEslintConfig(),
    });
    const [result] = await eslint.lintText(source, { filePath: 'src/value.ts' });
    expect(result?.messages.map((m) => m.ruleId)).toContain('@typescript-eslint/no-explicit-any');
  });

  it('the app preset lints config and instrumentation files', async () => {
    const eslint = new ESLint({
      cwd: import.meta.dirname,
      overrideConfigFile: true,
      overrideConfig: await createAppEslintConfig(),
    });
    for (const filePath of ['next.config.ts', 'vitest.config.js', 'instrumentation.ts']) {
      expect(await eslint.isPathIgnored(filePath)).toBe(false);
    }
  });
});

describe('createAppEslintConfig accessibility rules', () => {
  it('sets every jsx-a11y recommended rule at warn when the app asks for warn', async () => {
    const config = await createAppEslintConfig({ a11y: 'warn' });
    expect(config).toContainEqual(a11yBlock('warn'));
    expect(config).not.toContainEqual(a11yBlock('error'));
  });

  const component = [
    "import Image from 'next/image';",
    'export function Card({ onPick }: { onPick: () => void }) {',
    '  return (',
    '    <div onClick={onPick}>',
    '      <Image src="/a.png" width={1} height={1} />',
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n');

  const lintComponent = async (a11y?: 'error' | 'warn') => {
    const eslint = new ESLint({
      cwd: import.meta.dirname,
      overrideConfigFile: true,
      overrideConfig: await createAppEslintConfig(a11y ? { a11y } : {}),
    });
    const [result] = await eslint.lintText(component, { filePath: 'src/card.tsx' });
    const severityOf = (ruleId: string) =>
      result?.messages.find((message) => message.ruleId === ruleId)?.severity;
    return { result, severityOf };
  };

  it('fails a clickable div with no keyboard handler as an error by default', async () => {
    const { result, severityOf } = await lintComponent();
    expect(result?.messages.filter((message) => message.fatal)).toEqual([]);
    expect(severityOf('jsx-a11y/click-events-have-key-events')).toBe(2);
    expect(severityOf('jsx-a11y/no-static-element-interactions')).toBe(2);
  });

  it("keeps Next's alt-text options, so a next/image with no alt is an error", async () => {
    const { severityOf } = await lintComponent();
    expect(severityOf('jsx-a11y/alt-text')).toBe(2);
  });

  it('reports the same findings as warnings when the app asks for warn', async () => {
    const { severityOf } = await lintComponent('warn');
    expect(severityOf('jsx-a11y/click-events-have-key-events')).toBe(1);
    expect(severityOf('jsx-a11y/alt-text')).toBe(1);
  });
});

describe('createFunctionsEslintConfig', () => {
  it('builds the Cloud Functions config with the app scoped configs before eslint-config-prettier', async () => {
    const nodeGlobals = { ...globals.node, ...globals.es2021 };
    const unused = ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }];

    const config = await createFunctionsEslintConfig({ configs: [appScoped] });

    expect(config).toEqual([
      { ignores: ['lib/**', 'build/**'] },
      zeroSuppression,
      js.configs.recommended,
      ...tseslint.configs.recommended,
      {
        files: ['src/**/*.ts'],
        languageOptions: { globals: nodeGlobals },
        rules: {
          '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
          '@typescript-eslint/no-unused-vars': unused,
          'no-undef': 'off',
        },
      },
      {
        files: ['**/*.mjs'],
        languageOptions: { globals: nodeGlobals, sourceType: 'module' },
        rules: { 'no-unused-vars': unused },
      },
      {
        files: ['lib/**/*.js', '**/*.js'],
        languageOptions: { globals: nodeGlobals, sourceType: 'commonjs' },
        rules: { 'no-undef': 'error', 'no-unused-vars': unused },
      },
      appScoped,
      prettierCompat,
    ]);
  });

  it('adds the app ignores to the build output ignores', async () => {
    const [first] = await createFunctionsEslintConfig({ ignores: ['scratch/**'] });
    expect(first).toEqual({ ignores: ['lib/**', 'build/**', 'scratch/**'] });
  });
});
