export const STALE_TIMES = {
  short: 30_000,
  medium: 5 * 60_000,
  long: 30 * 60_000,
  forever: Number.POSITIVE_INFINITY,
} as const;
