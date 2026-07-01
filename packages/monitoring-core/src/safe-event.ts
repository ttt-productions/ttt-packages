/**
 * Safe-event allowlist helper — the safety-scoped telemetry layer.
 *
 * Safety-domain code (the app's `functions/src/safety/` + `functions/src/ncii/`)
 * must emit telemetry that carries ONLY a fixed allowlist of structurally-safe
 * fields — never content, evidence URLs, IPs, detector hashes, or credentials.
 * This helper takes an arbitrary object and returns a NEW object containing only
 * the allowlisted keys; every other key is dropped. `undefined`-valued
 * allowlisted keys are also dropped so the emitted payload stays minimal.
 *
 * This is the complement to the global {@link ./scrubber} redactor: the scrubber
 * is defense-in-depth against leaks from anywhere; the safe-event allowlist is
 * the positive contract for code that deliberately touches safety data — nothing
 * escapes unless it is on the list.
 *
 * GENERIC: the default allowlist (`caseId`, `phase`, `safeCode`, `traceId`) is
 * the safe field set named in the CSAM design doc, but the key set is
 * configurable so the app can extend/replace it without a package change.
 */

/** The safe field set every safety telemetry event may carry. */
export const DEFAULT_SAFE_EVENT_KEYS = ["caseId", "phase", "safeCode", "traceId"] as const;

export type DefaultSafeEventKey = (typeof DEFAULT_SAFE_EVENT_KEYS)[number];

/** The allowlisted-only shape produced from an arbitrary input. */
export type SafeEvent = {
  caseId?: string;
  phase?: string;
  safeCode?: string;
  traceId?: string;
  [key: string]: unknown;
};

export type BuildSafeEventOptions = {
  /**
   * Allowed keys. Defaults to {@link DEFAULT_SAFE_EVENT_KEYS}. Supply a custom
   * list (a superset or a different set) to extend the contract app-side without
   * changing this package.
   */
  allowedKeys?: readonly string[];
  /**
   * Keep allowlisted keys whose value is `undefined`. Defaults to false (drop
   * them) so the payload never carries empty slots.
   */
  keepUndefined?: boolean;
};

/**
 * Project an arbitrary object down to its allowlisted keys. Any key not on the
 * allowlist is dropped entirely — the returned object is a fresh copy, never the
 * input. Non-object input yields an empty object.
 *
 * @example
 * const evt = buildSafeEvent({
 *   caseId: 'case_123',
 *   phase: 'quarantine',
 *   safeCode: 'CS-DENY',
 *   traceId: 't-abc',
 *   // everything below is DROPPED:
 *   evidenceUrl: 'https://…/ncii-evidence/x',
 *   reporterIp: '203.0.113.7',
 *   detectorHash: 'ab12…',
 * });
 * // → { caseId, phase, safeCode, traceId }
 * captureMessage(JSON.stringify(evt)); // or attach as safe context
 */
export function buildSafeEvent(
  input: unknown,
  options: BuildSafeEventOptions = {}
): SafeEvent {
  const allowed = options.allowedKeys ?? DEFAULT_SAFE_EVENT_KEYS;
  const keepUndefined = options.keepUndefined ?? false;
  const out: SafeEvent = {};

  if (input === null || typeof input !== "object") {
    return out;
  }
  const record = input as Record<string, unknown>;

  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const value = record[key];
    if (value === undefined && !keepUndefined) continue;
    out[key] = value;
  }

  return out;
}
