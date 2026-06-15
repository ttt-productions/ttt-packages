/**
 * Generic reconnect / resume backoff state machine (client primitive, PURE).
 *
 * Tracks the connection lifecycle and computes exponential-with-jitter backoff
 * delays. The randomness source is injectable so it is fully deterministic in
 * tests; the default uses Math.random.
 */

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface ReconnectConfig {
  /** First retry delay floor (ms). Default 500. */
  baseDelayMs?: number;
  /** Maximum retry delay (ms). Default 30_000. */
  maxDelayMs?: number;
  /** Stop after this many consecutive failed attempts; `null` = retry forever. Default null. */
  maxAttempts?: number | null;
  /** Injectable [0,1) source for full-jitter. Default Math.random. */
  random?: () => number;
}

export interface ReconnectController {
  readonly state: ConnectionState;
  /** Count of consecutive failed attempts since the last successful open. */
  readonly attempt: number;
  /** A connection attempt is starting. */
  start(): void;
  /** Connection opened — resets the backoff. */
  onOpen(): void;
  /**
   * Connection closed/failed. Returns the delay (ms) to wait before the next
   * attempt, or `null` when `maxAttempts` is exhausted (the controller moves to
   * `closed`).
   */
  onClose(): number | null;
  /** Permanently stop (e.g. auth teardown). */
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
      // Full jitter — spread reconnects so a fleet doesn't thunder.
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
