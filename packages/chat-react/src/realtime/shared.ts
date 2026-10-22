export type GrantProvider = () => Promise<string>;

export class ChatAccessDeniedError extends Error {
  // Duck-typed so detection survives module-realm and re-throw boundaries.
  readonly isChatAccessDenied = true;
  constructor(message = 'Chat access denied') {
    super(message);
    this.name = 'ChatAccessDeniedError';
  }
}

export function isChatAccessDeniedError(err: unknown): err is ChatAccessDeniedError {
  return (
    err instanceof ChatAccessDeniedError ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { isChatAccessDenied?: unknown }).isChatAccessDenied === true)
  );
}

export interface TransportTimers {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (h: ReturnType<typeof setTimeout>) => void;
  now: () => number;
}

export const defaultTimers: TransportTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h),
  now: () => Date.now(),
};

export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export const TERMINAL_ERROR_CODE = {
  REVOKED: 'revoked',
  ACCESS_DENIED: 'access-denied',
} as const;

export type TerminalErrorCode = (typeof TERMINAL_ERROR_CODE)[keyof typeof TERMINAL_ERROR_CODE];

export function isTerminalErrorCode(code: string | null | undefined): code is TerminalErrorCode {
  return code === TERMINAL_ERROR_CODE.REVOKED || code === TERMINAL_ERROR_CODE.ACCESS_DENIED;
}

export const CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS = 15_000;

export const MAX_PENDING_SEND_ATTEMPTS = 5;

export const PENDING_SEND_MAX_AGE_MS = 60_000;

// Covers the backend's projection window, which the five-attempt cap (~10 s) does not.
export const SERVER_RETRYABLE_MAX_AGE_MS = 90_000;

export const SEND_RETRY_MIN_DELAY_MS = 250;
export const SEND_RETRY_MAX_DELAY_MS = 30_000;

export function newCorrelationId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
