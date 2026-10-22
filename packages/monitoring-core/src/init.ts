import type { MonitoringAdapter } from './adapter.js';
import type { MonitoringInitOptions } from './types.js';
import { NoopAdapter } from './adapters/noop.js';
import { SentryAdapter } from './adapters/sentry.js';
import { SentryNodeAdapter } from './adapters/sentry-node.js';
import { __resetSentryAdapter } from './adapters/create-sentry-adapter.js';

let adapter: MonitoringAdapter = NoopAdapter;
let initialized = false;
let currentOptions: MonitoringInitOptions | null = null;

const isBrowser = typeof window !== 'undefined';

export function getMonitoringAdapter(): MonitoringAdapter {
  return adapter;
}

function sameOptionValue(a: unknown, b: unknown, seen: WeakSet<object>): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
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
  return keys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(bRecord, key) &&
      sameOptionValue(aRecord[key], bRecord[key], seen),
  );
}

function assertCombinableOptions(options: MonitoringInitOptions): void {
  if (options.keepDefaultIntegrations !== undefined && options.defaultIntegrations !== undefined) {
    throw new Error(
      '[monitoring-core] keepDefaultIntegrations cannot be combined with defaultIntegrations: keepDefaultIntegrations already chooses which defaults run.',
    );
  }
}

export async function initMonitoring(options: MonitoringInitOptions, force = false): Promise<void> {
  assertCombinableOptions(options);

  if (initialized && !force && sameOptionValue(currentOptions, options, new WeakSet())) {
    return;
  }

  if (initialized) {
    console.warn('[monitoring-core] Re-initializing monitoring with new config');
  }

  currentOptions = options;

  const enabled = options.enabled ?? true;

  if (!enabled || options.provider === 'noop') {
    adapter = NoopAdapter;
    initialized = true;
    return;
  }

  // Installed before anything is awaited, so a capture issued while the SDK loads reaches it.
  if (options.provider === 'sentry') {
    adapter = SentryAdapter;
    await SentryAdapter.init(options);
    initialized = true;
    return;
  }

  if (options.provider === 'sentry-node') {
    if (isBrowser) {
      console.warn('[monitoring-core] Ignoring sentry-node init in browser environment');
      adapter = NoopAdapter;
      initialized = true;
      return;
    }

    adapter = SentryNodeAdapter;
    await SentryNodeAdapter.init(options);
    initialized = true;
    return;
  }

  adapter = NoopAdapter;
  initialized = true;
}

export function setMonitoringAdapter(next: MonitoringAdapter): void {
  adapter = next;
  initialized = true;
  currentOptions = null;
}

export function resetMonitoringAdapter(): void {
  adapter = NoopAdapter;
  initialized = false;
  currentOptions = null;
}

export function __resetMonitoring(): void {
  resetMonitoringAdapter();
  __resetSentryAdapter(SentryAdapter);
  __resetSentryAdapter(SentryNodeAdapter);
}
