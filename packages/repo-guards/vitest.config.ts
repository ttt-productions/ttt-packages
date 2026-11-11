import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'repo-guards',
    globals: true,
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
