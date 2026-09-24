// The email-verification refusal contract shared by the server gate (`createAssertAuth`'s
// `emailVerified` requirement on ./server) and the client that answers it. Pure: no Firebase
// runtime.
//
// A callable that requires a verified email refuses a caller whose ID token is not
// email-verified. The package owns that refusal, so it owns its one recognisable shape: a
// `failed-precondition` whose details name the reason. The client tells it apart from every
// other failed-precondition by that reason — never by the message text.

import { failedPreconditionDetails } from "./refusal.js";

/** The `details.reason` of the refusal a caller without a verified email receives. */
export const EMAIL_VERIFICATION_REQUIRED_REASON = "email-verification-required" as const;

/**
 * Structured details carried by the email-verification refusal. Server side it rides
 * `AuthAssertionError.details`; the consuming app forwards it as the `HttpsError` details, so
 * the client receives it on the callable error's `details`.
 */
export interface EmailVerificationRequiredDetails {
  readonly reason: typeof EMAIL_VERIFICATION_REQUIRED_REASON;
}

/** True when `details` is the email-verification refusal's structured details. */
export function isEmailVerificationRequiredDetails(
  details: unknown
): details is EmailVerificationRequiredDetails {
  if (!details || typeof details !== "object") return false;
  return (details as Record<string, unknown>).reason === EMAIL_VERIFICATION_REQUIRED_REASON;
}

/**
 * True when `err` is the email-verification refusal — a `failed-precondition` whose details
 * carry `reason: 'email-verification-required'`. Works on the server-side error and on the
 * client-side callable error alike, so the app has one recognizer for "show the verify-email
 * surface".
 */
export function isEmailVerificationRequiredError(err: unknown): boolean {
  return isEmailVerificationRequiredDetails(failedPreconditionDetails(err));
}
