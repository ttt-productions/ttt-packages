import { failedPreconditionDetails } from './refusal.js';

export const EMAIL_VERIFICATION_REQUIRED_REASON = 'email-verification-required' as const;

export interface EmailVerificationRequiredDetails {
  readonly reason: typeof EMAIL_VERIFICATION_REQUIRED_REASON;
}

export function isEmailVerificationRequiredDetails(
  details: unknown,
): details is EmailVerificationRequiredDetails {
  if (!details || typeof details !== 'object') return false;
  return (details as Record<string, unknown>).reason === EMAIL_VERIFICATION_REQUIRED_REASON;
}

export function isEmailVerificationRequiredError(err: unknown): boolean {
  return isEmailVerificationRequiredDetails(failedPreconditionDetails(err));
}
