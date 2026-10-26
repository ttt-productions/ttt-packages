import { applicationDefault, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const TEST_APP_NAME = 'in-memory-admin-test-app';

export interface TestAdminAppOptions {
  storageBucket?: string;
}

export function testAdminApp(options: TestAdminAppOptions = {}): App {
  const existing = getApps().find((app) => app.name === TEST_APP_NAME);
  if (existing) {
    if (existing.options.storageBucket !== options.storageBucket)
      throw new Error(
        `testAdminApp: the test app already runs with storageBucket ${String(existing.options.storageBucket)}, so it cannot be handed out with ${String(options.storageBucket)}`,
      );
    return existing;
  }
  // Auth and Storage send every request to a closed local port, and no default credential can be
  // found, so a case that reaches either without a spy fails at once instead of calling Google.
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9';
  process.env.STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9';
  process.env.GOOGLE_APPLICATION_CREDENTIALS = 'in-memory-admin-test-app-has-no-credential.json';
  const app = initializeApp(
    {
      credential: applicationDefault(),
      projectId: 'demo-test',
      ...(options.storageBucket ? { storageBucket: options.storageBucket } : {}),
    },
    TEST_APP_NAME,
  );
  // The Cloud Storage client retries a refused connection with backoff for seconds before it fails.
  getStorage(app).bucket(
    options.storageBucket ?? 'in-memory-admin-test-app',
  ).storage.retryOptions.autoRetry = false;
  return app;
}
