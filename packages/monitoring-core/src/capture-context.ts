/**
 * Capture-context application — the one place that decides how a capture's
 * context argument lands on a Sentry scope.
 *
 * Context keys become EXTRAS, with one exception: a key named `tags` whose
 * value is a flat string map is applied as REAL Sentry tags (`scope.setTag`),
 * so those values are searchable, filterable, and alert-routable. A `tags`
 * value that is not a flat string map (nested objects, arrays, non-string
 * values) is left as an ordinary extra — nothing is dropped.
 */

import type { ScopeLike } from "./types.js";

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

/**
 * Apply a capture context to a scope: real tags for a flat-string-map `tags`
 * entry, extras for everything else. Tolerates a scope missing either method.
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

    if (typeof target?.setExtra === "function") target.setExtra(key, value);
  }
}
