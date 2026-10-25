import type { AcceptanceRequiredDetails } from '../acceptance.js';
import type { EmailVerificationRequiredDetails } from '../email-verification.js';
import type { SignInRequiredDetails } from '../sign-in.js';

// firebase-functions' callable runtime instanceof-checks its own HttpsError class, which one built
// in this package's ESM dist fails (a 500 INTERNAL), so the consuming app builds the HttpsError.
export type AuthAssertionErrorCode =
  'unauthenticated' | 'failed-precondition' | 'not-found' | 'permission-denied';

export type AuthAssertionErrorDetails =
  AcceptanceRequiredDetails | EmailVerificationRequiredDetails | SignInRequiredDetails;

export class AuthAssertionError extends Error {
  readonly code: AuthAssertionErrorCode;
  readonly details?: AuthAssertionErrorDetails;

  constructor(code: AuthAssertionErrorCode, message: string, details?: AuthAssertionErrorDetails) {
    super(message);
    this.name = 'AuthAssertionError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
