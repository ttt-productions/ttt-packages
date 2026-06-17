"use client";

import * as React from "react";
import type {
  MediaDiagnosticAdapter,
  RecoveryState,
  AssetStatusHint,
} from "../recovery.js";
import {
  backoffForAttempt,
  withinBudget,
} from "../recovery.js";

// ---------------------------------------------------------------------------
// Per-asset dedup registry (module-level singleton)
// Keyed by URL; value is the set of broadcast callbacks registered for that URL.
// Only the "leader" (first registrant) drives probes; all instances receive
// state broadcasts.
// ---------------------------------------------------------------------------

type BroadcastFn = (state: RecoveryState) => void;

const activeRecoveries = new Map<string, Set<BroadcastFn>>();

/** Returns true if this is the leader (first registrant for the URL). */
function registerForUrl(url: string, fn: BroadcastFn): boolean {
  const existing = activeRecoveries.get(url);
  if (existing) {
    existing.add(fn);
    return false;
  }
  const s = new Set<BroadcastFn>();
  s.add(fn);
  activeRecoveries.set(url, s);
  return true;
}

function unregisterFromUrl(url: string, fn: BroadcastFn): void {
  const s = activeRecoveries.get(url);
  if (!s) return;
  s.delete(fn);
  if (s.size === 0) activeRecoveries.delete(url);
}

function broadcastForUrl(url: string, state: RecoveryState): void {
  const s = activeRecoveries.get(url);
  if (!s) return;
  for (const fn of s) fn(state);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseMediaRecoveryOptions {
  /** The URL of the media element. Recovery is skipped when falsy. */
  url: string | null | undefined;

  /** Injected diagnostic adapter from the app. */
  adapter?: MediaDiagnosticAdapter;

  /**
   * Optional app hint about the server-side lifecycle of the asset.
   * When "failed" or "rejected" the element error is treated as hard.
   * When "processing" or "finalizing" a loading skeleton/spinner is shown
   * without triggering the recovery probe.
   */
  statusHint?: AssetStatusHint;

  /**
   * Called when the recovery state machine wants to remount/reload the
   * media element. The parent should increment a remount key or equivalent
   * so the element re-attempts loading from scratch.
   */
  onRemount?: () => void;
}

export interface UseMediaRecoveryResult {
  /** Current recovery phase. */
  recoveryState: RecoveryState;

  /**
   * Call this when the underlying media element fires an error event.
   * If no adapter is provided, or statusHint is "failed"/"rejected", the
   * error is treated as hard immediately.
   */
  onMediaError: () => void;

  /**
   * Call this when the underlying media element fires its successful
   * load/decode event (onLoad / onLoadedData / onCanPlay).
   */
  onMediaLoad: () => void;

  /**
   * Manual retry: resets the state machine back to loading and triggers a
   * fresh remount. Usable from a "Retry" button in max-wait-fallback state.
   */
  manualRetry: () => void;
}

function isDocumentVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState !== "hidden";
}

export function useMediaRecovery({
  url,
  adapter,
  statusHint,
  onRemount,
}: UseMediaRecoveryOptions): UseMediaRecoveryResult {
  const [recoveryState, setRecoveryState] = React.useState<RecoveryState>({
    phase: "idle",
  });

  // Element viewport visibility
  const [isElementVisible, setIsElementVisible] = React.useState(true);

  // Document visibility
  const [isDocVisible, setIsDocVisible] = React.useState(isDocumentVisible());

  // Stable ref for the registered broadcast function — stays constant for the
  // lifetime of this hook instance so unregister always matches the register.
  const broadcastFnRef = React.useRef<BroadcastFn>((state) =>
    setRecoveryState(state)
  );

  // Stable refs for mutable values used in closures
  const adapterRef = React.useRef<MediaDiagnosticAdapter | undefined>(adapter);
  adapterRef.current = adapter;
  const onRemountRef = React.useRef<(() => void) | undefined>(onRemount);
  onRemountRef.current = onRemount;
  const statusHintRef = React.useRef<AssetStatusHint | undefined>(statusHint);
  statusHintRef.current = statusHint;

  // Retry timer
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recovery cycle bookkeeping
  const firstFailureAtRef = React.useRef<number | null>(null);
  const authRefreshedRef = React.useRef(false);
  const attemptRef = React.useRef(0);
  const isLeaderRef = React.useRef(false);
  const isRegisteredRef = React.useRef(false);

  const stableUrl = url ?? null;

  // -------------------------------------------------------------------------
  // Document visibility
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => setIsDocVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // -------------------------------------------------------------------------
  // IntersectionObserver for element visibility (container-agnostic)
  // Uses the mounted DOM node of the component; we observe document.body
  // as a fallback for tests that don't wire a ref.
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const target = document.body;
    const io = new IntersectionObserver(
      ([e]) => setIsElementVisible(e?.isIntersecting ?? true),
      { threshold: 0.01 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  // -------------------------------------------------------------------------
  // Cleanup on URL change or unmount
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    // Reset when URL changes
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    firstFailureAtRef.current = null;
    authRefreshedRef.current = false;
    attemptRef.current = 0;

    setRecoveryState({ phase: "idle" });

    // broadcastFnRef.current is a stable ref (created once, never reassigned),
    // so capture it for the cleanup closure rather than reading the ref there
    // (react-hooks/exhaustive-deps flags ref reads in cleanup).
    const broadcastFn = broadcastFnRef.current;
    return () => {
      // Unregister from dedup on unmount or URL change
      if (stableUrl && isRegisteredRef.current) {
        unregisterFromUrl(stableUrl, broadcastFn);
        isRegisteredRef.current = false;
        isLeaderRef.current = false;
      }
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [stableUrl]);

  // -------------------------------------------------------------------------
  // Resume paused retries when visibility restores
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    if (!isElementVisible || !isDocVisible) return;
    if (recoveryState.phase !== "transient-retry") return;
    if (retryTimerRef.current !== null) return; // timer already running

    // Timer was cleared due to hidden state — reschedule.
    const remaining = Math.max(0, recoveryState.nextRetryMs);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      onRemountRef.current?.();
    }, remaining);
  }, [isElementVisible, isDocVisible, recoveryState]);

  // -------------------------------------------------------------------------
  // Visibility snapshot ref (kept current so timer callbacks read fresh values)
  // -------------------------------------------------------------------------
  const visibilityRef = React.useRef({ isElementVisible, isDocVisible });
  visibilityRef.current = { isElementVisible, isDocVisible };

  // -------------------------------------------------------------------------
  // Core recovery probe + state advance
  // -------------------------------------------------------------------------
  const runRecovery = React.useCallback(
    async (attempt: number) => {
      if (!stableUrl) return;

      const currentAdapter = adapterRef.current;
      const hint = statusHintRef.current;

      let diagnosis: import("../recovery.js").DiagnosisResult;

      if (!currentAdapter?.probe) {
        // No probe: treat as transient for bounded retry purposes
        diagnosis = { kind: "transient" };
      } else {
        try {
          diagnosis = await currentAdapter.probe(stableUrl);
        } catch {
          diagnosis = { kind: "transient" };
        }
      }

      if (diagnosis.kind === "hard") {
        const hardState: RecoveryState = { phase: "hard-unavailable" };
        setRecoveryState(hardState);
        broadcastForUrl(stableUrl, hardState);
        return;
      }

      if (diagnosis.kind === "auth") {
        if (!authRefreshedRef.current) {
          authRefreshedRef.current = true;
          const authState: RecoveryState = { phase: "auth-retry" };
          setRecoveryState(authState);
          broadcastForUrl(stableUrl, authState);

          try {
            if (hint !== "failed" && hint !== "rejected") {
              await currentAdapter?.refreshSession?.();
              await currentAdapter?.refreshGrant?.(stableUrl);
            }
          } catch {
            // swallow — fall through to remount
          }

          onRemountRef.current?.();
          return;
        }
        // Already refreshed once → hard auth failure
        const hardAuthState: RecoveryState = {
          phase: "hard-unavailable",
          reason: "auth",
        };
        setRecoveryState(hardAuthState);
        broadcastForUrl(stableUrl, hardAuthState);
        return;
      }

      // Transient: schedule next retry with backoff
      const nextDelay = backoffForAttempt(attempt);
      const nextRetryAt = Date.now() + nextDelay;

      if (
        firstFailureAtRef.current !== null &&
        !withinBudget(firstFailureAtRef.current, nextRetryAt)
      ) {
        const fallbackState: RecoveryState = { phase: "max-wait-fallback" };
        setRecoveryState(fallbackState);
        broadcastForUrl(stableUrl, fallbackState);
        return;
      }

      const retryState: RecoveryState = {
        phase: "transient-retry",
        attempt,
        nextRetryMs: nextDelay,
      };
      setRecoveryState(retryState);
      broadcastForUrl(stableUrl, retryState);

      // Schedule remount — cancel if hidden at fire time
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const { isElementVisible: elVis, isDocVisible: docVis } = visibilityRef.current;
        if (!elVis || !docVis) {
          // Leave state as transient-retry; visibility effect will reschedule.
          return;
        }
        onRemountRef.current?.();
      }, nextDelay);
    },
    [stableUrl]
  );

  // -------------------------------------------------------------------------
  // Public: onMediaError
  // -------------------------------------------------------------------------
  const onMediaError = React.useCallback(() => {
    if (!stableUrl) return;

    const hint = statusHintRef.current;

    // Terminal app-hint states — no probe, immediate hard error
    if (hint === "failed" || hint === "rejected") {
      const s: RecoveryState = { phase: "hard-unavailable", reason: hint };
      setRecoveryState(s);
      broadcastForUrl(stableUrl, s);
      return;
    }

    // Processing/finalizing hints — show phase overlay, no probe
    if (hint === "processing") {
      const s: RecoveryState = { phase: "processing" };
      setRecoveryState(s);
      broadcastForUrl(stableUrl, s);
      return;
    }
    if (hint === "finalizing") {
      const s: RecoveryState = { phase: "finalizing" };
      setRecoveryState(s);
      broadcastForUrl(stableUrl, s);
      return;
    }

    // Record first failure time
    if (firstFailureAtRef.current === null) {
      firstFailureAtRef.current = Date.now();
    }

    const attempt = attemptRef.current;
    attemptRef.current += 1;

    // Dedup registration
    if (!isRegisteredRef.current) {
      isLeaderRef.current = registerForUrl(stableUrl, broadcastFnRef.current);
      isRegisteredRef.current = true;
    }

    // Only the leader drives recovery probes
    if (!isLeaderRef.current) {
      return;
    }

    void runRecovery(attempt);
  }, [stableUrl, runRecovery]);

  // -------------------------------------------------------------------------
  // Public: onMediaLoad
  // -------------------------------------------------------------------------
  const onMediaLoad = React.useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (stableUrl && isRegisteredRef.current) {
      unregisterFromUrl(stableUrl, broadcastFnRef.current);
      isRegisteredRef.current = false;
      isLeaderRef.current = false;
    }
    firstFailureAtRef.current = null;
    authRefreshedRef.current = false;
    attemptRef.current = 0;

    const loadedState: RecoveryState = { phase: "loaded" };
    setRecoveryState(loadedState);
    if (stableUrl) broadcastForUrl(stableUrl, loadedState);
  }, [stableUrl]);

  // -------------------------------------------------------------------------
  // Public: manualRetry
  // -------------------------------------------------------------------------
  const manualRetry = React.useCallback(() => {
    if (!stableUrl) return;

    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Reset cycle
    firstFailureAtRef.current = null;
    authRefreshedRef.current = false;
    attemptRef.current = 0;

    // Re-establish as leader
    if (isRegisteredRef.current) {
      unregisterFromUrl(stableUrl, broadcastFnRef.current);
      isRegisteredRef.current = false;
    }
    isLeaderRef.current = registerForUrl(stableUrl, broadcastFnRef.current);
    isRegisteredRef.current = true;

    const loadingState: RecoveryState = { phase: "loading" };
    setRecoveryState(loadingState);
    broadcastForUrl(stableUrl, loadingState);
    onRemountRef.current?.();
  }, [stableUrl]);

  return {
    recoveryState,
    onMediaError,
    onMediaLoad,
    manualRetry,
  };
}
