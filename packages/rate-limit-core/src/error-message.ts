export interface RateLimitErrorMessageOptions {
  /** Epoch ms when the limit resets (returned by `checkRateLimit`). */
  reset: number;
  /** Optional context shown in the message (e.g. "Upload"). */
  context?: string;
  /** Optional copy overrides — generic defaults are used when omitted. */
  copy?: {
    /** Suffix appended to every message. Default: "" (none). */
    suffix?: string;
    /** Template builder. Receives the formatted time string and context. */
    format?: (args: { timeString: string; context?: string }) => string;
  };
}

/**
 * Generate a user-friendly rate-limit error message with relative time.
 * Copy is fully consumer-controlled — TTT supplies its "Early-launch
 * rate limits in place" suffix at the call site.
 */
export function getRateLimitErrorMessage(opts: RateLimitErrorMessageOptions): string {
  const { reset, context, copy } = opts;
  const minutes = Math.max(1, Math.ceil((reset - Date.now()) / 60_000));
  const timeString = minutes === 1 ? "1 minute" : `${minutes} minutes`;

  if (copy?.format) {
    return copy.format({ timeString, context });
  }

  const base = context
    ? `${context} rate limit exceeded. Try again in ${timeString}.`
    : `Rate limit exceeded. Try again in ${timeString}.`;

  return copy?.suffix ? `${base} ${copy.suffix}` : base;
}
