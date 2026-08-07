import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../constants/business-user.js';

/**
 * The one TTT account-password contract, shared by registration, password reset,
 * and any future password surface. Length only — TTT enforces no composition
 * requirements, so spaces, printable Unicode, and emoji are all allowed.
 *
 * Deliberately NOT named `validatePassword`: Firebase's own SDK exports a
 * `validatePassword(auth, password)` that reads mutable hosted project policy.
 * This helper is the stable product contract; the two must never be confused.
 *
 * The value is never trimmed, normalized, or otherwise mutated, and confirmation
 * matching is the caller's job. Length is JavaScript string length (UTF-16 code
 * units), matching HTML input length behavior and the Firebase SDK — a
 * surrogate-pair emoji therefore counts as 2.
 *
 * Client validation is UX; the Firebase-enforced password policy remains the
 * security boundary (ENG-006).
 *
 * @returns `null` when the password is acceptable (both boundaries inclusive),
 *          otherwise the user-facing reason it was rejected.
 */
export function validateTttPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be no more than ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}
