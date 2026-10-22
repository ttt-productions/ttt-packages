import type { MonitoringLevel, ScopeLike } from './types.js';

export function asFlatStringTagMap(value: unknown): Record<string, string> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== 'string') return null;
    out[key] = entry;
  }
  return out;
}

const MONITORING_LEVELS: readonly string[] = ['fatal', 'error', 'warning', 'info', 'debug'];

export function asMonitoringLevel(value: unknown): MonitoringLevel | null {
  return typeof value === 'string' && MONITORING_LEVELS.includes(value)
    ? (value as MonitoringLevel)
    : null;
}

export function applyCaptureContext(scope: unknown, context: Record<string, unknown>): void {
  const target = scope as Partial<ScopeLike> | null | undefined;

  for (const [key, value] of Object.entries(context)) {
    if (key === 'tags') {
      const tagMap = asFlatStringTagMap(value);
      if (tagMap) {
        if (typeof target?.setTag === 'function') {
          for (const [tagKey, tagValue] of Object.entries(tagMap)) {
            target.setTag(tagKey, tagValue);
          }
        }
        continue;
      }
    }

    if (key === 'level') {
      const level = asMonitoringLevel(value);
      if (level && typeof target?.setLevel === 'function') {
        target.setLevel(level);
        continue;
      }
    }

    if (typeof target?.setExtra === 'function') target.setExtra(key, value);
  }
}
