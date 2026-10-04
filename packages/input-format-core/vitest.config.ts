import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'input-format-core',
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
