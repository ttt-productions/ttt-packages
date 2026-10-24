import js from '@eslint/js';
import type { Linter } from 'eslint';
import prettierCompat from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export interface EslintPresetOptions {
  ignores?: readonly string[];
  configs?: readonly Linter.Config[];
}

export interface AppEslintPresetOptions extends EslintPresetOptions {
  a11y?: 'error' | 'warn';
}

const ZERO_SUPPRESSION: Linter.Config = { linterOptions: { noInlineConfig: true } };

const APP_IGNORES = [
  '.next/**',
  'node_modules/**',
  '.firebase/**',
  'functions/**',
  // ESLint does not honor .gitignore, so the E2E harness's generated artifacts are ignored here.
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
];

const UNUSED_VARS_ALLOW_UNDERSCORE = {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
};

const APP_RULES: Linter.Config = {
  files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
  // eslint-config-next registers react-hooks and flat config errors on a redefinition: rules only.
  languageOptions: {
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
    },
  },
  rules: {
    // RULE-STD-MEDIA-101 bans next/image, the replacement this rule demands; served files render through the media renderer.
    '@next/next/no-img-element': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        ...UNUSED_VARS_ALLOW_UNDERSCORE,
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
};

// Type-aware: each TypeScript file is read through the nearest tsconfig.json that includes it.
const typeAwareNoAny = (files: string[]): Linter.Config => ({
  files,
  languageOptions: { parserOptions: { projectService: true } },
  rules: {
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
  },
});

type RuleEntry = NonNullable<Linter.Config['rules']>[string];

// eslint-config-next registers jsx-a11y and flat config errors on a second registration, so this
// sets rules only; a severity-only entry keeps the options Next set (its Image alt-text options).
function jsxA11yRecommended(
  nextConfigs: Linter.Config[],
  severity: 'error' | 'warn',
): Linter.Config {
  const plugin = nextConfigs.find((config) => config.plugins?.['jsx-a11y'])?.plugins?.['jsx-a11y'];
  const recommended = (plugin?.configs?.recommended as Linter.Config | undefined)?.rules;
  if (!recommended) {
    throw new Error(
      'eslint-config-next no longer registers eslint-plugin-jsx-a11y with a recommended config',
    );
  }
  const rules: Record<string, RuleEntry> = {};
  for (const [name, entry] of Object.entries(recommended)) {
    if (entry === undefined) continue;
    const level = Array.isArray(entry) ? entry[0] : entry;
    if (level === 'off' || level === 0) continue;
    rules[name] = Array.isArray(entry) ? [severity, ...entry.slice(1)] : severity;
  }
  return { files: ['**/*.tsx', '**/*.jsx'], rules };
}

export async function createAppEslintConfig(
  options: AppEslintPresetOptions = {},
): Promise<Linter.Config[]> {
  // Imported here: the Functions tree loads this module without eslint-config-next installed.
  const [{ default: nextCoreWebVitals }, { default: nextTypescript }] = await Promise.all([
    import('eslint-config-next/core-web-vitals'),
    import('eslint-config-next/typescript'),
  ]);
  return [
    { ignores: [...APP_IGNORES, ...(options.ignores ?? [])] },
    ZERO_SUPPRESSION,
    js.configs.recommended,
    ...(tseslint.configs.recommended as Linter.Config[]),
    ...(nextCoreWebVitals as Linter.Config[]),
    ...(nextTypescript as Linter.Config[]),
    jsxA11yRecommended(nextCoreWebVitals as Linter.Config[], options.a11y ?? 'error'),
    APP_RULES,
    typeAwareNoAny(['**/*.ts', '**/*.tsx']),
    ...(options.configs ?? []),
    prettierCompat,
  ];
}

export async function createFunctionsEslintConfig(
  options: EslintPresetOptions = {},
): Promise<Linter.Config[]> {
  // Imported here: the Next.js tree loads this module without globals installed.
  const { default: globals } = await import('globals');
  const nodeGlobals = { ...globals.node, ...globals.es2021 };
  return [
    { ignores: ['lib/**', 'build/**', ...(options.ignores ?? [])] },
    ZERO_SUPPRESSION,
    js.configs.recommended,
    ...(tseslint.configs.recommended as Linter.Config[]),
    {
      files: ['src/**/*.ts'],
      languageOptions: { globals: nodeGlobals },
      rules: {
        '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true }],
        '@typescript-eslint/no-unused-vars': ['error', UNUSED_VARS_ALLOW_UNDERSCORE],
        'no-undef': 'off',
      },
    },
    // noInlineConfig ignores inline /* global */ comments, so Node globals come from config.
    {
      files: ['**/*.mjs'],
      languageOptions: { globals: nodeGlobals, sourceType: 'module' },
      rules: { 'no-unused-vars': ['error', UNUSED_VARS_ALLOW_UNDERSCORE] },
    },
    {
      files: ['lib/**/*.js', '**/*.js'],
      languageOptions: { globals: nodeGlobals, sourceType: 'commonjs' },
      rules: {
        'no-undef': 'error',
        'no-unused-vars': ['error', UNUSED_VARS_ALLOW_UNDERSCORE],
      },
    },
    typeAwareNoAny(['**/*.ts']),
    ...(options.configs ?? []),
    prettierCompat,
  ];
}
