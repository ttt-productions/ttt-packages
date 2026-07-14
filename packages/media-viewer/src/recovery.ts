/**
 * Generic bounded media-recovery state machine.
 *
 * Owns: backoff schedule, state transition logic, dedup key shape.
 * Does NOT own: probe implementation, session/grant refresh, telemetry.
 * Those are injected via MediaDiagnosticAdapter.
 */

// ---------------------------------------------------------------------------
// Diagnostic adapter — app implements, package consumes opaquely
// ---------------------------------------------------------------------------

/**
 * Opaque diagnosis result returned by the app's probe(). The package treats
 * this value OPAQUELY — it only checks the `kind` discriminant; all
 * domain-specific interpretation (a product-specific deny header, HTTP status
 * codes, etc.) lives in the app adapter.
 */
export type DiagnosisResult =
  | { kind: "transient" }
  | { kind: "auth" }
  | { kind: "hard" };

/**
 * Optional hint from the app about the asset's known server-side lifecycle
 * state. When provided it informs which recovery states are applicable.
 * The package treats these opaquely — it does not interpret product-specific
 * pendingMedia.publicationState fields directly.
 */
export type AssetStatusHint =
  | "processing"   // app knows asset is still being processed — show skeleton
  | "finalizing"   // app knows asset is activating/publishing — show spinner
  | "live"         // app believes asset is live — recovery is appropriate
  | "failed"       // terminal processing failure — no recovery
  | "rejected";    // terminal rejection — no recovery

/**
 * Injected adapter interface. The consuming app implements this; generic consumers
 * may supply a no-op or partial adapter.
 *
 * Every method is optional — callers guard before invoking.
 */
export interface MediaDiagnosticAdapter {
  /**
   * Issue a credentialed HEAD probe against the given URL and return a
   * diagnosis. Should resolve quickly (e.g. 5 s timeout). Must never throw
   * — return { kind: "transient" } on network errors.
   */
  probe?: (url: string) => Promise<DiagnosisResult>;

  /**
   * Attempt to refresh the media session (re-mint the HttpOnly cookie).
   * Called at most once per auth-recovery cycle. Must never throw.
   */
  refreshSession?: () => Promise<void>;

  /**
   * Attempt to refresh a scoped grant for the given URL.
   * Called at most once per auth-recovery cycle. Must never throw.
   */
  refreshGrant?: (url: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Recovery state machine
// ---------------------------------------------------------------------------

export type RecoveryState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "processing" }      // app hint says processing — no error, show skeleton
  | { phase: "finalizing" }      // app hint says finalizing — no error, show spinner
  | { phase: "loaded" }          // element load/decode succeeded
  | { phase: "transient-retry"; attempt: number; nextRetryMs: number }
  | { phase: "propagating" }     // alias label for first transient states (visible in UI)
  | { phase: "auth-retry" }      // refreshing session/grant
  | { phase: "hard-unavailable"; reason?: string }
  | { phase: "max-wait-fallback" }; // bounded retry exhausted — show manual retry

// Backoff schedule in ms: 2s → 5s → 10s → 20s → 30s → 30s (then cap at 30s)
export const BACKOFF_SCHEDULE_MS = [2000, 5000, 10000, 20000, 30000, 30000] as const;

/** Maximum total time from first failure before giving up, in ms. */
export const MAX_RECOVERY_DURATION_MS = 120_000;

/**
 * Load watchdog: maximum time a visible, loading media element may sit with
 * NEITHER a load nor an error event before the viewer synthesizes an error
 * and enters the bounded recovery path. Guarantees every viewer resolves to
 * a terminal state — an asset that hangs (blocked, dead connection, gateway
 * that never responds) can otherwise show a skeleton forever, since the
 * recovery machine only engages on an error event. Overridable per-viewer
 * via the `loadTimeoutMs` prop; `0` disables the watchdog.
 */
export const LOAD_WATCHDOG_MS = 20_000;

/**
 * Maximum time the `processing` / `finalizing` overlay phases may hold before
 * transitioning to `max-wait-fallback` (manual Retry). These phases are driven
 * by an app status hint and were previously unbounded — a doc that never
 * reaches a terminal status left the viewer spinning forever.
 */
export const PHASE_MAX_WAIT_MS = 180_000;

/** Jitter factor (±20%). */
const JITTER_FACTOR = 0.2;

/**
 * Apply ±20% jitter to a backoff delay. Deterministic seed not required —
 * slight randomness prevents thundering herds across many assets.
 */
export function applyJitter(delayMs: number): number {
  const delta = delayMs * JITTER_FACTOR;
  return Math.round(delayMs - delta + Math.random() * delta * 2);
}

/**
 * Return the backoff delay for a given attempt index (0-based).
 * Clamps to the last schedule entry beyond the end.
 */
export function backoffForAttempt(attempt: number): number {
  const raw = BACKOFF_SCHEDULE_MS[Math.min(attempt, BACKOFF_SCHEDULE_MS.length - 1)];
  return applyJitter(raw);
}

/**
 * True when the total elapsed time since first failure would still be within
 * the MAX_RECOVERY_DURATION_MS budget after the next retry.
 */
export function withinBudget(firstFailureAt: number, nextRetryAt: number): boolean {
  return nextRetryAt - firstFailureAt <= MAX_RECOVERY_DURATION_MS;
}
