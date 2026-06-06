// Flat config (ESLint 9) for the ttt-packages monorepo. Lints the published package source under
// packages/*. Mirrors the rule philosophy of ttt-prod's eslint.config.js — `no-explicit-any` off,
// `_`-prefixed unused allowed, react-hooks elevated to error — but WITHOUT the Next.js rule set:
// these are framework-agnostic libraries, only some of which ship React.
//
// Scope is `packages` only (see the root `lint` script). Build tooling under scripts/ and generated
// output under docs/generated and **/dist are not linted.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/scripts/**', // package build helpers (e.g. theme-core copy-styles.cjs) — CommonJS Node tooling, not library source
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true, // `const { omit, ...rest } = x` to drop a key is intentional
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }], // best-effort try/catch around media/storage APIs is intentional
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
