import { failedPreconditionDetails } from './refusal.js';

export const ACCEPTANCE_REQUIRED_REASON = 'acceptance-required' as const;

export interface AcceptanceRequiredDetails {
  readonly reason: typeof ACCEPTANCE_REQUIRED_REASON;
  readonly requiredLevel: number;
  readonly acceptedLevel: number;
}

export function normalizeAcceptanceLevel(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function isAcceptanceRequiredDetails(
  details: unknown,
): details is AcceptanceRequiredDetails {
  if (!details || typeof details !== 'object') return false;
  const d = details as Record<string, unknown>;
  return (
    d.reason === ACCEPTANCE_REQUIRED_REASON &&
    typeof d.requiredLevel === 'number' &&
    typeof d.acceptedLevel === 'number'
  );
}

export function isAcceptanceRequiredError(err: unknown): boolean {
  return isAcceptanceRequiredDetails(failedPreconditionDetails(err));
}
