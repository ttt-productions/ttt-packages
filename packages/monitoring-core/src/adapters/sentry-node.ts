import type { MonitoringAdapter } from "../adapter.js";
import { createSentryAdapter } from "./create-sentry-adapter.js";

export const SentryNodeAdapter: MonitoringAdapter = createSentryAdapter(() =>
  import("./sentry-node-sdk.js").then((sdkModule) => sdkModule.importSentryNode())
);
