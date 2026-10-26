import type { MonitoringAdapter } from '../adapter.js';
import { createSentryAdapter } from './create-sentry-adapter.js';
import { importSentryBrowser } from './sentry-browser-sdk.js';

export const SentryAdapter: MonitoringAdapter = createSentryAdapter(importSentryBrowser);
