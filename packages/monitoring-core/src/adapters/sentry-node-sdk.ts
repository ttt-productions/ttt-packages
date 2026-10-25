import type { SentrySdkLike } from './create-sentry-adapter.js';

// package.json's "browser" field maps this file to an empty module, so a browser bundle never
// pulls in the Node SDK.
export function importSentryNode(): Promise<SentrySdkLike> {
  return import('@sentry/node');
}
