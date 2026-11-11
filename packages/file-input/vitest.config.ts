import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'file-input',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
