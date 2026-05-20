import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'chat-schemas',
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
