import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'firebase-helpers',
    globals: true,
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
