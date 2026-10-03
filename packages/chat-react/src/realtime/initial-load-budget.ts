// The first-open failure budget both realtime clients share: a client that has not loaded its
// first data CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS after its first attempt started reports the first
// open as failed — whether its attempts failed or one is still hanging (a grant mint stuck until
// its timeout, a socket that opened but never sent a snapshot) — while it keeps retrying in the
// background. One implementation for the channel and inbox sockets.

import { CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS, type TransportTimers } from './shared.js';

export class InitialLoadBudget {
  /** When the first attempt of the current no-data run started; null once data has loaded. */
  private startedAt: number | null = null;
  private timer: ReturnType<TransportTimers['setTimeout']> | null = null;

  constructor(
    private readonly timers: TransportTimers,
    /** Called when the budget runs out with still no data. */
    private readonly onExhausted: () => void,
  ) {}

  /**
   * A lifecycle is starting without data. A fresh start opens a new budget; otherwise the budget
   * already running (or spent) is kept.
   */
  begin(fresh: boolean): void {
    if (!fresh && this.startedAt != null) return;
    this.startedAt = this.timers.now();
    this.arm(CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS);
  }

  /** An attempt failed before any data loaded: once the budget is spent, that is reported at once. */
  noteFailedAttempt(): void {
    if (this.startedAt == null) return;
    if (this.timers.now() - this.startedAt >= CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS) this.onExhausted();
  }

  /**
   * The user asked to retry. The spent budget stays spent — a retry that fails is reported at
   * once — and a retry that hangs is reported a full budget from now.
   */
  manualRetry(): void {
    if (this.startedAt == null) this.startedAt = this.timers.now();
    this.arm(CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS);
  }

  /** The first data loaded — there is no first-open failure left to report. */
  loaded(): void {
    this.clearTimer();
    this.startedAt = null;
  }

  /** The lifecycle ended; nothing may fire for it. */
  dispose(): void {
    this.clearTimer();
  }

  private arm(ms: number): void {
    this.clearTimer();
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      if (this.startedAt != null) this.onExhausted();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer != null) {
      this.timers.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
