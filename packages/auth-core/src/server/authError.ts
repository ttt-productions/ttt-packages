/**
 * Typed failure channel for `createAssertAuth`.
 *
 * Every EXPECTED auth outcome (not signed in, email unverified, missing profile,
 * account not in good standing) throws an `AuthAssertionError` whose `code` is
 * deliberately the matching `HttpsError` code string, so a consuming Cloud
 * Function maps it 1:1 at the app boundary:
 *
 *   catch (err) {
 *     if (err instanceof AuthAssertionError) throw new HttpsError(err.code, err.message);
 *     throw err;
 *   }
 *
 * WHY THE PACKAGE MUST NOT BUILD THE HttpsError ITSELF (2026-07-20, live on hosted
 * dev): firebase-functions 7.2.5 ships TWO distinct `HttpsError` classes — the one
 * exported from the ESM entry `firebase-functions/v2/https`, and the one the CJS
 * callable runtime closes over and `instanceof`-checks at
 * `lib/common/providers/https.js`. An `HttpsError` constructed by this package's
 * ESM `dist` fails that identity check, so `onCall` logged "Unhandled error" and
 * replaced a correct 400 with `500 INTERNAL`. Measured:
 *
 *   ESM class === CJS class ?              false
 *   esm-built error instanceof CJS class ? false
 *   httpErrorCode.status:                  400   (the error itself was correct)
 *
 * Because `assertAuth` is the first line of every callable, that turned EVERY auth
 * rejection — unauthenticated, unverified email, suspended, banned — into a generic
 * 500: users saw "An Error Occurred" instead of the verify-email dialog, and Sentry
 * filled with 500s that were really expected answers. Constructing the HttpsError in
 * APP module space fixes the identity permanently and cannot regress when
 * firebase-functions repackages.
 *
 * This also brings auth-core in line with architectural-preferences Rule 17 (generic
 * packages stay framework-agnostic; the TTT-side adapter binds the framework) and
 * mirrors `report-core`'s `ReportCoreTaskError`, which already works this way.
 */
export type AuthAssertionErrorCode =
  | "unauthenticated"
  | "failed-precondition"
  | "not-found"
  | "permission-denied";

export class AuthAssertionError extends Error {
  readonly code: AuthAssertionErrorCode;

  constructor(code: AuthAssertionErrorCode, message: string) {
    super(message);
    this.name = "AuthAssertionError";
    this.code = code;
  }
}
