import type { MonitoringAdapter } from "../adapter.js";
import { createSentryAdapter, type SentrySdkLike } from "./create-sentry-adapter.js";

export const SentryAdapter: MonitoringAdapter = createSentryAdapter(
  () => import("@sentry/nextjs") as Promise<unknown> as Promise<SentrySdkLike>
);
