import { defineConfig } from 'vitest/config';

// Repo-level boundary guard suite. Runs as part of the root `npm run test`
// via vitest.workspace.ts. Node environment — these tests read built dist and
// source manifests; they do not render React or touch Firebase.
export default defineConfig({
  test: {
    name: 'boundary',
    environment: 'node',
    globals: true,
    include: ['./**/*.test.ts'],
  },
});
