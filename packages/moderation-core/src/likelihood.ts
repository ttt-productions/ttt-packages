import type { Likelihood } from './types.js';

export const LIKELIHOOD_MAP: Record<string | number, Likelihood> = {
  0: 'UNKNOWN',
  1: 'VERY_UNLIKELY',
  2: 'UNLIKELY',
  3: 'POSSIBLE',
  4: 'LIKELY',
  5: 'VERY_LIKELY',
};

export const LIKELIHOOD_ORDER: Record<Likelihood, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  VERY_LIKELY: 5,
};

export function likelihoodToString(value: string | number | null | undefined): Likelihood {
  if (value === null || value === undefined) return 'UNKNOWN';
  if (typeof value === 'string') {
    return (LIKELIHOOD_MAP[value as keyof typeof LIKELIHOOD_MAP] ??
      (value as Likelihood)) as Likelihood;
  }
  return LIKELIHOOD_MAP[value] ?? 'UNKNOWN';
}

export function isRejectionLikelihood(
  value: string | number | null | undefined,
  rejectionLikelihoods: ReadonlySet<string>,
): boolean {
  const str = likelihoodToString(value);
  return rejectionLikelihoods.has(str);
}
