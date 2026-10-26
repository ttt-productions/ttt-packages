import { resolve } from 'node:path';
import type { TestProjectConfiguration, ViteUserConfig } from 'vitest/config';

export interface AppVitestOptions {
  root: string;
  exclude?: readonly string[];
  browserEntryTests?: readonly string[];
}

export interface FunctionsVitestOptions {
  inline?: readonly string[];
}

export interface RulesVitestOptions {
  root: string;
}

const srcAlias = (root: string) => ({ '@': resolve(root, './src') });

function browserEntryProject(include: string[]): TestProjectConfiguration {
  return {
    extends: true,
    // Node's loader cannot run a browser build's extensionless imports, so every dependency goes
    // through Vite here. A pattern, not `true`: `extends` concatenates this list onto the root's, and
    // Vitest calls `.test` on every entry of a list.
    resolve: { conditions: ['browser'] },
    test: {
      name: 'app-browser',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include,
      server: { deps: { inline: [/.*/] } },
    },
  };
}

export async function createAppVitestConfig(options: AppVitestOptions): Promise<ViteUserConfig> {
  // Imported here: the Functions tree loads this module without @vitejs/plugin-react installed.
  const { default: react } = await import('@vitejs/plugin-react');
  const browserEntryTests = [...(options.browserEntryTests ?? [])];
  return {
    plugins: [react()],
    test: {
      globals: true,
      // Through Vitest's transformer, a test's vi.mock reaches the package's own imports.
      server: { deps: { inline: [/@ttt-productions\/.*/] } },
      exclude: [
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/build/**',
        '**/functions/**',
        ...(options.exclude ?? []),
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
            exclude: ['**/src/__tests__/guards/**', ...browserEntryTests],
          },
        },
        ...(browserEntryTests.length ? [browserEntryProject(browserEntryTests)] : []),
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
    resolve: { alias: srcAlias(options.root) },
  };
}

export function createFunctionsVitestConfig(options: FunctionsVitestOptions = {}): ViteUserConfig {
  return {
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: ['node_modules/**', 'lib/**'],
      setupFiles: ['./src/test/setup.ts'],
      server: { deps: { inline: [...(options.inline ?? [])] } },
    },
  };
}

export function createRulesVitestConfig(options: RulesVitestOptions): ViteUserConfig {
  return {
    test: {
      globals: true,
      environment: 'node',
      include: ['src/__tests__/rules/**/*.{test,spec}.ts'],
      testTimeout: 15000,
      // Every file clears and seeds the one shared emulator project.
      fileParallelism: false,
    },
    resolve: { alias: srcAlias(options.root) },
  };
}
