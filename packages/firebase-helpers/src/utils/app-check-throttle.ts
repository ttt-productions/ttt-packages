export const APP_CHECK_THROTTLE_CODES = [
  'appCheck/throttled',
  'appCheck/initial-throttle',
] as const;

export type AppCheckThrottleCode = (typeof APP_CHECK_THROTTLE_CODES)[number];

const THROTTLE_SET: ReadonlySet<string> = new Set(APP_CHECK_THROTTLE_CODES);

export function isAppCheckThrottleError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && THROTTLE_SET.has(code);
}
