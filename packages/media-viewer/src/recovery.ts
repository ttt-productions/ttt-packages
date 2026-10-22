export type DiagnosisResult = { kind: 'transient' } | { kind: 'auth' } | { kind: 'hard' };

export type AssetStatusHint = 'processing' | 'finalizing' | 'live' | 'failed' | 'rejected';

export interface MediaDiagnosticAdapter {
  probe?: (url: string) => Promise<DiagnosisResult>;

  refreshSession?: () => Promise<void>;

  refreshGrant?: (url: string) => Promise<void>;
}

export type RecoveryState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'processing' }
  | { phase: 'finalizing' }
  | { phase: 'loaded' }
  | { phase: 'transient-retry'; attempt: number; nextRetryMs: number }
  | { phase: 'propagating' }
  | { phase: 'auth-retry' }
  | { phase: 'hard-unavailable'; reason?: string }
  | { phase: 'max-wait-fallback' };

export const BACKOFF_SCHEDULE_MS = [2000, 5000, 10000, 20000, 30000, 30000] as const;

export const MAX_RECOVERY_DURATION_MS = 120_000;

export const LOAD_WATCHDOG_MS = 20_000;

export const PHASE_MAX_WAIT_MS = 180_000;

const JITTER_FACTOR = 0.2;

export function applyJitter(delayMs: number): number {
  const delta = delayMs * JITTER_FACTOR;
  return Math.round(delayMs - delta + Math.random() * delta * 2);
}

export function backoffForAttempt(attempt: number): number {
  const raw = BACKOFF_SCHEDULE_MS[Math.min(attempt, BACKOFF_SCHEDULE_MS.length - 1)];
  return applyJitter(raw);
}

export function withinBudget(firstFailureAt: number, nextRetryAt: number): boolean {
  return nextRetryAt - firstFailureAt <= MAX_RECOVERY_DURATION_MS;
}
