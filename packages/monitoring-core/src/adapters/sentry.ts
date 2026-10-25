import type { MonitoringAdapter } from '../adapter.js';
import { createSentryAdapter } from './create-sentry-adapter.js';

export const SentryAdapter: MonitoringAdapter = createSentryAdapter(() => import('@sentry/nextjs'));
