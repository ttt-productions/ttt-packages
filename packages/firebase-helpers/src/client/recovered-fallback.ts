/**
 * The context key `callCallable` sets to `true` on its one informational report: a limited-use
 * invocation that was throttled and then succeeded on the standard-token retry. Internal to the
 * package — `callCallable` writes it and `createCallables` filters on it.
 */
export const RECOVERED_FALLBACK_MARKER = "limitedUseAppCheckFallback";

/** True for the recovered limited-use fallback report, false for every failure report. */
export function isRecoveredFallbackReport(context: Record<string, unknown> | undefined): boolean {
  return context?.[RECOVERED_FALLBACK_MARKER] === true;
}
