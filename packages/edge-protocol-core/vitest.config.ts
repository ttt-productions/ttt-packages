import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'edge-protocol-core',
    globals: true,
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
