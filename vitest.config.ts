import { defineConfig } from 'vitest/config';

// Vitest 4 replaced the vitest.workspace.ts file with `test.projects`.
export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      'test/boundary/vitest.config.ts',
    ],
  },
});
