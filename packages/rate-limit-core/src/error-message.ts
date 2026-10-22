export interface RateLimitErrorMessageOptions {
  reset: number;
  context?: string;
  copy?: {
    suffix?: string;
    format?: (args: { timeString: string; context?: string }) => string;
  };
}

export function getRateLimitErrorMessage(opts: RateLimitErrorMessageOptions): string {
  const { reset, context, copy } = opts;
  const minutes = Math.max(1, Math.ceil((reset - Date.now()) / 60_000));
  const timeString = minutes === 1 ? '1 minute' : `${minutes} minutes`;

  if (copy?.format) {
    return copy.format({ timeString, context });
  }

  const base = context
    ? `${context} rate limit exceeded. Try again in ${timeString}.`
    : `Rate limit exceeded. Try again in ${timeString}.`;

  return copy?.suffix ? `${base} ${copy.suffix}` : base;
}
