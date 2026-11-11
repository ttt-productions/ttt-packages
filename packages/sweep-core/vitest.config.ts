import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'sweep-core',
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
