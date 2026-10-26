import type { SentrySdkLike } from './create-sentry-adapter.js';

export function importSentryBrowser(): Promise<SentrySdkLike> {
  return import('@sentry/nextjs');
}
