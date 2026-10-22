import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { describe, expect, it } from 'vitest';
import {
  createAppVitestConfig,
  createFunctionsVitestConfig,
  createRulesVitestConfig,
} from '../src/node/vitest.js';

const root = resolve('/repo/app');

const pluginNames = (plugins: unknown): string[] =>
  (plugins as unknown[]).flat(Infinity).map((plugin) => (plugin as { name: string }).name);

describe('createAppVitestConfig', () => {
  it('builds the app and guards projects with the app excludes beside the Functions tree', async () => {
    const { plugins, ...config } = await createAppVitestConfig({
      root,
      exclude: ['**/some-worker/**'],
    });

    expect(pluginNames(plugins)).toEqual(pluginNames(react()));
    expect(config).toEqual({
      test: {
        globals: true,
        server: { deps: { inline: [/@ttt-productions\/.*/] } },
        exclude: [
          '**/node_modules/**',
          '**/.next/**',
          '**/dist/**',
          '**/build/**',
          '**/functions/**',
          '**/some-worker/**',
          '**/e2e/**',
          '**/e2e-hosted-dev/**',
          '**/__tests__/rules/**',
        ],
        projects: [
          {
            extends: true,
            test: {
              name: 'app',
              environment: 'jsdom',
              setupFiles: ['./src/test/setup.ts'],
              exclude: ['**/src/__tests__/guards/**'],
            },
          },
          {
            extends: true,
            test: {
              name: 'guards',
              environment: 'node',
              include: ['src/__tests__/guards/**/*.test.ts'],
            },
          },
        ],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'lcov'],
          exclude: ['node_modules/**', '.next/**', 'src/test/**', '**/*.d.ts', '**/*.config.*'],
        },
      },
      resolve: { alias: { '@': resolve(root, 'src') } },
    });
  });
});

describe('createFunctionsVitestConfig', () => {
  it('builds the Functions config with the app inline packages', () => {
    expect(createFunctionsVitestConfig({ inline: ['@scope/a', '@scope/b'] })).toEqual({
      test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['node_modules/**', 'lib/**'],
        setupFiles: ['./src/test/setup.ts'],
        server: { deps: { inline: ['@scope/a', '@scope/b'] } },
      },
    });
  });
});

describe('createRulesVitestConfig', () => {
  it('builds the whole rules config from the app root', () => {
    expect(createRulesVitestConfig({ root })).toEqual({
      test: {
        globals: true,
        environment: 'node',
        include: ['src/__tests__/rules/**/*.{test,spec}.ts'],
        testTimeout: 15000,
        fileParallelism: false,
      },
      resolve: { alias: { '@': resolve(root, 'src') } },
    });
  });
});
