import { CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS, type TransportTimers } from './shared.js';

export class InitialLoadBudget {
  private startedAt: number | null = null;
  private timer: ReturnType<TransportTimers['setTimeout']> | null = null;

  constructor(
    private readonly timers: TransportTimers,
    private readonly onExhausted: () => void,
  ) {}

  begin(fresh: boolean): void {
    if (!fresh && this.startedAt != null) return;
    this.startedAt = this.timers.now();
    this.arm(CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS);
  }

  noteFailedAttempt(): void {
    if (this.startedAt == null) return;
    if (this.timers.now() - this.startedAt >= CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS)
      this.onExhausted();
  }

  manualRetry(): void {
    if (this.startedAt == null) this.startedAt = this.timers.now();
    this.arm(CHAT_INITIAL_LOAD_FAILURE_BUDGET_MS);
  }

  loaded(): void {
    this.clearTimer();
    this.startedAt = null;
  }

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
