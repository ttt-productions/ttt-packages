export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ReconnectConfig {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number | null;
  random?: () => number;
}

export interface ReconnectController {
  readonly state: ConnectionState;
  readonly attempt: number;
  start(): void;
  onOpen(): void;
  onClose(): number | null;
  close(): void;
  reset(): void;
}

export function createReconnectController(config: ReconnectConfig = {}): ReconnectController {
  const baseDelayMs = config.baseDelayMs ?? 500;
  const maxDelayMs = config.maxDelayMs ?? 30_000;
  const maxAttempts = config.maxAttempts ?? null;
  const random = config.random ?? Math.random;

  let state: ConnectionState = 'idle';
  let attempt = 0;

  return {
    get state() {
      return state;
    },
    get attempt() {
      return attempt;
    },
    start() {
      if (state === 'closed') return;
      state = attempt === 0 ? 'connecting' : 'reconnecting';
    },
    onOpen() {
      if (state === 'closed') return;
      state = 'open';
      attempt = 0;
    },
    onClose() {
      if (state === 'closed') return null;
      attempt += 1;
      if (maxAttempts !== null && attempt >= maxAttempts) {
        state = 'closed';
        return null;
      }
      state = 'reconnecting';
      const exp = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      return Math.floor(random() * exp);
    },
    close() {
      state = 'closed';
    },
    reset() {
      state = 'idle';
      attempt = 0;
    },
  };
}
