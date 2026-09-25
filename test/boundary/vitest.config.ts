import { defineConfig } from 'vitest/config';

// Repo-level boundary guard suite. Runs as part of the root `npm run test` as one
// of the root vitest.config.ts `test.projects`. Node environment — these tests read
// built dist, package source, and manifests; they do not render React or touch Firebase.
export default defineConfig({
  test: {
    name: 'boundary',
    environment: 'node',
    globals: true,
    include: ['./**/*.test.ts'],
  },
});
