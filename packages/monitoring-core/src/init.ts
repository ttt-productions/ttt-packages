import type { MonitoringAdapter } from "./adapter.js";
import type { MonitoringInitOptions } from "./types.js";
import { NoopAdapter } from "./adapters/noop.js";
import { SentryAdapter } from "./adapters/sentry.js";
import { SentryNodeAdapter } from "./adapters/sentry-node.js";

let adapter: MonitoringAdapter = NoopAdapter;
let initialized = false;

export function getMonitoringAdapter(): MonitoringAdapter {
  return adapter;
}

export async function initMonitoring(options: MonitoringInitOptions): Promise<void> {
  if (initialized) return;

  const enabled = options.enabled ?? true;

  if (!enabled || options.provider === "noop") {
    adapter = NoopAdapter;
    initialized = true;
    return;
  }

  if (options.provider === "sentry") {
    adapter = SentryAdapter;
    await adapter.init(options);
    initialized = true;
    return;
  }

  if (options.provider === "sentry-node") {
    adapter = SentryNodeAdapter;
    await adapter.init(options);
    initialized = true;
    return;
  }

  adapter = NoopAdapter;
  initialized = true;
}