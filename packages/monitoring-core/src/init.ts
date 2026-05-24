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

  // Local-dev gate: force noop adapter when any Firebase emulator signal is
  // present, or when the explicit kill switch is set. This keeps Sentry
  // completely inert during local dev (npm run dev:local + emulators),
  // including not importing the SDK. Hosted dev and hosted prod are
  // unaffected — they never have these env vars set.
  const isLocalDev =
    (typeof process !== "undefined" &&
      (process.env?.NEXT_PUBLIC_USE_EMULATORS === "true" ||
        process.env?.FUNCTIONS_EMULATOR === "true" ||
        !!process.env?.FIREBASE_EMULATOR_HUB ||
        process.env?.NEXT_PUBLIC_SENTRY_ENABLED === "false"));

  if (!enabled || options.provider === "noop" || isLocalDev) {
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

/**
 * Test seam — install a specific adapter without going through `initMonitoring`.
 *
 * Intended for unit tests in `monitoring-core` and in any consuming package
 * that wants to install a recording fake. Not for production code.
 *
 * Marking the module as initialized prevents a subsequent `initMonitoring`
 * call with the same options from being short-circuited by the dedup check.
 */
export function setMonitoringAdapter(next: MonitoringAdapter): void {
  adapter = next;
  initialized = true;
  currentOptions = null;
}

/**
 * Test seam — restore the default `NoopAdapter` and clear init state.
 *
 * After calling this, `getMonitoringAdapter()` returns the `NoopAdapter`
 * singleton and the next `initMonitoring` call runs end-to-end without
 * being deduped against any previous options.
 */
export function resetMonitoringAdapter(): void {
  adapter = NoopAdapter;
  initialized = false;
  currentOptions = null;
}
