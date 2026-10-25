import { unauthenticatedRefusal } from './refusal.js';

export const SIGN_IN_REQUIRED_REASON = 'sign-in-required' as const;

export interface SignInRequiredDetails {
  readonly reason: typeof SIGN_IN_REQUIRED_REASON;
}

export function isSignInRequiredDetails(details: unknown): details is SignInRequiredDetails {
  if (!details || typeof details !== 'object') return false;
  return (details as Record<string, unknown>).reason === SIGN_IN_REQUIRED_REASON;
}

export function isSignInRequiredError(err: unknown): boolean {
  const refusal = unauthenticatedRefusal(err);
  return refusal !== null && isSignInRequiredDetails(refusal.details);
}

export function isPlatformTokenRefusal(err: unknown): boolean {
  const refusal = unauthenticatedRefusal(err);
  return refusal !== null && !isSignInRequiredDetails(refusal.details);
}
