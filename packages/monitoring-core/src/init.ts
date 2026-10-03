import type { MonitoringAdapter } from "./adapter.js";
import type { MonitoringInitOptions } from "./types.js";
import { NoopAdapter } from "./adapters/noop.js";
import { SentryAdapter } from "./adapters/sentry.js";
import { SentryNodeAdapter } from "./adapters/sentry-node.js";

let adapter: MonitoringAdapter = NoopAdapter;
let initialized = false;
let currentOptions: MonitoringInitOptions | null = null;

const isBrowser = typeof window !== "undefined";

export function getMonitoringAdapter(): MonitoringAdapter {
  return adapter;
}

/**
 * Option equality for the re-init check. Functions (`beforeSend`, an integration's hooks)
 * compare by reference — a serialization would drop them and call two different hooks
 * equal; arrays and plain objects compare member by member.
 */
function sameOptionValue(a: unknown, b: unknown, seen: WeakSet<object>): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (seen.has(a)) return false;
  seen.add(a);
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => sameOptionValue(item, b[index], seen));
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const keys = Object.keys(aRecord);
  if (keys.length !== Object.keys(bRecord).length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(bRecord, key) && sameOptionValue(aRecord[key], bRecord[key], seen));
}

/** Option pairs no provider can honour. Checked before any provider choice, so an emulator or
 *  Noop run refuses the same configuration a deployed one would. */
function assertCombinableOptions(options: MonitoringInitOptions): void {
  if (options.keepDefaultIntegrations !== undefined && options.defaultIntegrations !== undefined) {
    throw new Error(
      "[monitoring-core] keepDefaultIntegrations cannot be combined with defaultIntegrations: keepDefaultIntegrations already chooses which defaults run."
    );
  }
}

export async function initMonitoring(
  options: MonitoringInitOptions,
  force = false
): Promise<void> {
  assertCombinableOptions(options);

  // Prevent unnecessary re-init
  if (initialized && !force && sameOptionValue(currentOptions, options, new WeakSet())) {
    return;
  }

  if (initialized) {
    console.warn("[monitoring-core] Re-initializing monitoring with new config");
  }

  currentOptions = options;

  const enabled = options.enabled ?? true;

  // Local-dev gate: force the noop adapter whenever a Firebase emulator signal is present,
  // so local dev (emulators) never imports or initializes the SDK. Hosted environments
  // never set these. There is no other off switch: a deployment without a DSN sends nothing.
  const isLocalDev =
    (typeof process !== "undefined" &&
      (process.env?.NEXT_PUBLIC_USE_EMULATORS === "true" ||
        process.env?.FUNCTIONS_EMULATOR === "true" ||
        !!process.env?.FIREBASE_EMULATOR_HUB));

  if (!enabled || options.provider === "noop" || isLocalDev) {
    adapter = NoopAdapter;
    initialized = true;
    return;
  }

  // The provider adapter is installed BEFORE anything is awaited: a capture issued while the
  // SDK loads reaches the real adapter, which holds it until its own init has run.
  if (options.provider === "sentry") {
    adapter = SentryAdapter;
    await SentryAdapter.init(options);
    initialized = true;
    return;
  }

  if (options.provider === "sentry-node") {
    if (isBrowser) {
      console.warn(
        "[monitoring-core] Ignoring sentry-node init in browser environment"
      );
      adapter = NoopAdapter;
      initialized = true;
      return;
    }

    adapter = SentryNodeAdapter;
    await SentryNodeAdapter.init(options);
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
