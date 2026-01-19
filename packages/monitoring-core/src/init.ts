import type { MonitoringAdapter } from "./adapter.js";
import type { MonitoringInitOptions } from "./types.js";
import { NoopAdapter } from "./adapters/noop.js";
import { SentryAdapter } from "./adapters/sentry.js";
import { SentryNodeAdapter } from "./adapters/sentry-node.js";

let adapter: MonitoringAdapter = NoopAdapter;
let initialized = false;
let currentOptions: MonitoringInitOptions | null = null;

export function getMonitoringAdapter(): MonitoringAdapter {
  return adapter;
}

export async function initMonitoring(options: MonitoringInitOptions, force = false): Promise<void> {
  // Allow re-initialization if options changed or force flag set
  if (initialized && !force && JSON.stringify(currentOptions) === JSON.stringify(options)) {
    return;
  }

  // Warn if re-initializing
  if (initialized) {
    console.warn('[monitoring-core] Re-initializing monitoring with new config');
  }

  currentOptions = options;
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