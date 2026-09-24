// The acceptance-level contract shared by the server gate (`createAssertAuth`'s optional
// `acceptance` config on ./server) and the client that answers it. Pure: no Firebase runtime.
//
// A consuming app publishes documents its users must accept, and tracks acceptance as a
// monotonically increasing whole-number LEVEL: the app decides what raises the required level
// and where the caller's accepted level is stored (a custom claim named by the app). The package
// only compares the two numbers and reports a refusal in one recognisable shape.

/** The `details.reason` of the refusal a caller below the required level receives. */
export const ACCEPTANCE_REQUIRED_REASON = "acceptance-required" as const;

/**
 * Structured details carried by the acceptance refusal. Server side it rides
 * `AuthAssertionError.details`; the consuming app forwards it as the `HttpsError` details, so
 * the client receives it on the callable error's `details`.
 */
export interface AcceptanceRequiredDetails {
  readonly reason: typeof ACCEPTANCE_REQUIRED_REASON;
  /** The level the backend currently requires. */
  readonly requiredLevel: number;
  /** The level read from the caller's token (0 when absent or unreadable). */
  readonly acceptedLevel: number;
}

/**
 * Normalize an acceptance level: a finite number ≥ 0, floored to a whole number. Anything
 * else — absent, a string, NaN, a negative — is 0. Applied to BOTH sides of the comparison:
 * an unreadable accepted level can never satisfy a positive requirement, and an unreadable
 * required level requires nothing.
 */
export function normalizeAcceptanceLevel(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/** True when `details` is the acceptance refusal's structured details. */
export function isAcceptanceRequiredDetails(details: unknown): details is AcceptanceRequiredDetails {
  if (!details || typeof details !== "object") return false;
  const d = details as Record<string, unknown>;
  return (
    d.reason === ACCEPTANCE_REQUIRED_REASON &&
    typeof d.requiredLevel === "number" &&
    typeof d.acceptedLevel === "number"
  );
}

// The HttpsError code the refusal carries, as the server (`failed-precondition`) and the
// Firebase client SDK (`functions/failed-precondition`) spell it.
const ACCEPTANCE_REFUSAL_CODES: ReadonlySet<string> = new Set([
  "failed-precondition",
  "functions/failed-precondition",
]);

/**
 * True when `err` is the acceptance refusal — a `failed-precondition` whose details carry
 * `reason: 'acceptance-required'`. Works on the server-side error and on the client-side
 * callable error alike, so the app has one recognizer for "show the acceptance prompt".
 */
export function isAcceptanceRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; details?: unknown };
  return typeof e.code === "string" && ACCEPTANCE_REFUSAL_CODES.has(e.code) && isAcceptanceRequiredDetails(e.details);
}
