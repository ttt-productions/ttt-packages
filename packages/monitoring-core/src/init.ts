import type { MonitoringAdapter } from "./adapter.js";
import type { MonitoringInitOptions } from "./types.js";
import { NoopAdapter } from "./adapters/noop.js";

let adapter: MonitoringAdapter = NoopAdapter;
let initialized = false;
let currentOptions: MonitoringInitOptions | null = null;

const isBrowser = typeof window !== "undefined";

export function getMonitoringAdapter(): MonitoringAdapter {
  return adapter;
}

export async function initMonitoring(
  options: MonitoringInitOptions,
  force = false
): Promise<void> {
  // Prevent unnecessary re-init
  if (
    initialized &&
    !force &&
    JSON.stringify(currentOptions) === JSON.stringify(options)
  ) {
    return;
  }

  if (initialized) {
    console.warn("[monitoring-core] Re-initializing monitoring with new config");
  }

  currentOptions = options;

  const enabled = options.enabled ?? true;

  if (!enabled || options.provider === "noop") {
    adapter = NoopAdapter;
    initialized = true;
    return;
  }

  // ---------- BROWSER (Next.js / React) ----------
  if (options.provider === "sentry") {
    const { SentryAdapter } = await import("./adapters/sentry.js");
    adapter = SentryAdapter;
    await adapter.init(options);
    initialized = true;
    return;
  }

  // ---------- NODE (Firebase Functions, servers) ----------
  if (options.provider === "sentry-node") {
    if (isBrowser) {
      console.warn(
        "[monitoring-core] Ignoring sentry-node init in browser environment"
      );
      adapter = NoopAdapter;
      initialized = true;
      return;
    }

    const { SentryNodeAdapter } = await import("./adapters/sentry-node.js");
    adapter = SentryNodeAdapter;
    await adapter.init(options);
    initialized = true;
    return;
  }

  // Fallback
  adapter = NoopAdapter;
  initialized = true;
}
