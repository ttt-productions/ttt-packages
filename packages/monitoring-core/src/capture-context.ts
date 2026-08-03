/**
 * Capture-context application — the one place that decides how a capture's
 * context argument lands on a Sentry scope.
 *
 * Context keys become EXTRAS, with two exceptions — the keys call sites pass
 * meaning a FIRST-CLASS Sentry field rather than a free-form attachment:
 *
 *   - `tags`, a flat string map, is applied as REAL Sentry tags
 *     (`scope.setTag`), so those values are searchable, filterable, and
 *     alert-routable;
 *   - `level`, one of the severity names, is applied as the capture's REAL
 *     severity (`scope.setLevel`), so a call site asking for `warning` is not
 *     reported as an error.
 *
 * Both are all-or-nothing: a value that does not fit the shape (a `tags` map
 * with a non-string value, an unrecognized `level`) stays an ordinary extra, so
 * nothing is ever dropped. A scope that cannot honour the field (no `setLevel`)
 * also falls back to the extra.
 */

import type { MonitoringLevel, ScopeLike } from "./types.js";

/**
 * Narrow an arbitrary value to a flat `Record<string, string>`, or `null` when
 * it is not one. An empty object qualifies (it carries no tags and no
 * information, so it yields neither a tag nor an extra).
 */
export function asFlatStringTagMap(value: unknown): Record<string, string> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;

  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry !== "string") return null;
    out[key] = entry;
  }
  return out;
}

const MONITORING_LEVELS: readonly string[] = ["fatal", "error", "warning", "info", "debug"];

/** Narrow a value to a monitoring severity name, or `null` when it is not one. */
export function asMonitoringLevel(value: unknown): MonitoringLevel | null {
  return typeof value === "string" && MONITORING_LEVELS.includes(value) ? (value as MonitoringLevel) : null;
}

/**
 * Apply a capture context to a scope: real tags for a flat-string-map `tags`
 * entry, the real severity for a recognized `level`, extras for everything else.
 * Tolerates a scope missing any of the methods.
 */
export function applyCaptureContext(scope: unknown, context: Record<string, unknown>): void {
  const target = scope as Partial<ScopeLike> | null | undefined;

  for (const [key, value] of Object.entries(context)) {
    if (key === "tags") {
      const tagMap = asFlatStringTagMap(value);
      if (tagMap) {
        if (typeof target?.setTag === "function") {
          for (const [tagKey, tagValue] of Object.entries(tagMap)) {
            target.setTag(tagKey, tagValue);
          }
        }
        continue;
      }
    }

    if (key === "level") {
      const level = asMonitoringLevel(value);
      if (level && typeof target?.setLevel === "function") {
        target.setLevel(level);
        continue;
      }
    }

    if (typeof target?.setExtra === "function") target.setExtra(key, value);
  }
}
