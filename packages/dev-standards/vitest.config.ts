import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'dev-standards',
    globals: true,
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
