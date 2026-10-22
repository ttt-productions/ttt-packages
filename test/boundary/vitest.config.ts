import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'boundary',
    environment: 'node',
    globals: true,
    include: ['./**/*.test.ts'],
  },
});
