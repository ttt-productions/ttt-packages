export const RECOVERED_FALLBACK_MARKER = 'limitedUseAppCheckFallback';

export function isRecoveredFallbackReport(context: Record<string, unknown> | undefined): boolean {
  return context?.[RECOVERED_FALLBACK_MARKER] === true;
}
