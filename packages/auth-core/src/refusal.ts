// The code both structured `assertAuth` refusals carry — the acceptance refusal
// (./acceptance.ts) and the email-verification refusal (./email-verification.ts) — and the one
// place their recognizers read it. Internal: the root exports the recognizers, not this.
// Pure: no Firebase runtime.

// The HttpsError code, as the server (`failed-precondition`) and the Firebase client SDK
// (`functions/failed-precondition`) spell it.
const FAILED_PRECONDITION_CODES: ReadonlySet<string> = new Set([
  "failed-precondition",
  "functions/failed-precondition",
]);

/**
 * The `details` of `err` when it is a `failed-precondition` error in either spelling —
 * server-side or client-side callable error alike — otherwise `undefined`. Each recognizer then
 * asks whether those details are its own refusal's, so refusals are told apart by
 * `details.reason`, never by message text.
 */
export function failedPreconditionDetails(err: unknown): unknown {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: unknown; details?: unknown };
  return typeof e.code === "string" && FAILED_PRECONDITION_CODES.has(e.code) ? e.details : undefined;
}
