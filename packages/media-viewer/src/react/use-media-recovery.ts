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
  PHASE_MAX_WAIT_MS,
} from "../recovery.js";

// ---------------------------------------------------------------------------
// Per-asset dedup registry (module-level singleton)
// Keyed by URL. Every instance whose element failed for that URL joins; exactly
// one member — the leader — drives probes, and every member receives the state
// broadcasts. When the leader leaves (unmount, URL change, successful load) the
// earliest remaining member is promoted, so a recovery never loses its driver.
// ---------------------------------------------------------------------------

interface RecoveryMember {
  /** A state another member broadcast for this URL. */
  receive: (state: RecoveryState) => void;
  /** This member became the leader because the previous one left. */
  promote: () => void;
}

interface UrlRecovery {
  members: Set<RecoveryMember>;
  leader: RecoveryMember | null;
}

const activeRecoveries = new Map<string, UrlRecovery>();

function joinRecovery(url: string, member: RecoveryMember): void {
  let entry = activeRecoveries.get(url);
  if (!entry) {
    entry = { members: new Set(), leader: null };
    activeRecoveries.set(url, entry);
  }
  entry.members.add(member);
  if (!entry.leader) entry.leader = member;
}

/** Makes `member` the leader (a manual retry takes over the recovery it restarts). */
function claimRecoveryLead(url: string, member: RecoveryMember): void {
  joinRecovery(url, member);
  activeRecoveries.get(url)!.leader = member;
}

function leaveRecovery(url: string, member: RecoveryMember): void {
  const entry = activeRecoveries.get(url);
  if (!entry || !entry.members.delete(member)) return;
  if (entry.members.size === 0) {
    activeRecoveries.delete(url);
    return;
  }
  if (entry.leader === member) {
    const next = entry.members.values().next().value as RecoveryMember;
    entry.leader = next;
    next.promote();
  }
}

function isRecoveryLeader(url: string, member: RecoveryMember): boolean {
  return activeRecoveries.get(url)?.leader === member;
}

function broadcastForUrl(url: string, state: RecoveryState, from: RecoveryMember): void {
  const entry = activeRecoveries.get(url);
  if (!entry) return;
  for (const member of entry.members) {
    if (member !== from) member.receive(state);
  }
}

/** Phases in which a failed element is still being recovered (not settled, not waiting on the user). */
function isRecoveringPhase(state: RecoveryState): boolean {
  return (
    state.phase !== "hard-unavailable" &&
    state.phase !== "max-wait-fallback" &&
    state.phase !== "loaded"
  );
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
   * Whether the viewer's own element is on screen, from the viewer's one
   * IntersectionObserver (MEDIA-102). A scheduled retry waits while it is false.
   * Omitted = visible (a viewer that does not observe itself).
   */
  isElementVisible?: boolean;

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
  isElementVisible = true,
  statusHint,
  onRemount,
}: UseMediaRecoveryOptions): UseMediaRecoveryResult {
  const [recoveryState, setRecoveryState] = React.useState<RecoveryState>({
    phase: "idle",
  });
  const recoveryStateRef = React.useRef(recoveryState);
  recoveryStateRef.current = recoveryState;

  // Document visibility
  const [isDocVisible, setIsDocVisible] = React.useState(isDocumentVisible());

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
  const isRegisteredRef = React.useRef(false);
  // True from this instance's element failing until it loads: a failed element
  // that is not the leader waits on the shared recovery.
  const hasFailedRef = React.useRef(false);

  const stableUrl = url ?? null;

  // Kept current each render so the registry member (created once) acts on it.
  const runRecoveryRef = React.useRef<(attempt: number) => Promise<void>>(async () => {});
  const remountForSharedRecoveryRef = React.useRef<() => void>(() => {});

  // This instance's membership in the per-URL registry. Created once, so a
  // leave always matches its join; its methods read the refs above.
  const [member] = React.useState<RecoveryMember>(() => ({
    receive: (state) => {
      recoveryStateRef.current = state;
      setRecoveryState(state);
      // The shared recovery reports the asset loadable again (another member
      // loaded it, or restarted it by hand): a failed element retries now.
      if ((state.phase === "loaded" || state.phase === "loading") && hasFailedRef.current) {
        remountForSharedRecoveryRef.current();
      }
    },
    promote: () => {
      if (!hasFailedRef.current || !isRecoveringPhase(recoveryStateRef.current)) return;
      const attempt = attemptRef.current;
      attemptRef.current += 1;
      void runRecoveryRef.current(attempt);
    },
  }));

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
    hasFailedRef.current = false;

    setRecoveryState({ phase: "idle" });

    return () => {
      // Leave the dedup registry on unmount or URL change; a follower takes the lead.
      if (stableUrl && isRegisteredRef.current) {
        isRegisteredRef.current = false;
        leaveRecovery(stableUrl, member);
      }
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [stableUrl, member]);

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
  // Bounded processing/finalizing: these hint-driven phases were unbounded —
  // a doc that never reaches a terminal status left the overlay spinning
  // forever. After PHASE_MAX_WAIT_MS they resolve to max-wait-fallback
  // (manual Retry), the same terminal the retry budget uses.
  // -------------------------------------------------------------------------
  React.useEffect(() => {
    if (recoveryState.phase !== "processing" && recoveryState.phase !== "finalizing") {
      return;
    }
    const timer = setTimeout(() => {
      const fallbackState: RecoveryState = { phase: "max-wait-fallback" };
      setRecoveryState(fallbackState);
      if (stableUrl) broadcastForUrl(stableUrl, fallbackState, member);
    }, PHASE_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [recoveryState.phase, stableUrl, member]);

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
        broadcastForUrl(stableUrl, hardState, member);
        return;
      }

      if (diagnosis.kind === "auth") {
        if (!authRefreshedRef.current) {
          authRefreshedRef.current = true;
          const authState: RecoveryState = { phase: "auth-retry" };
          setRecoveryState(authState);
          broadcastForUrl(stableUrl, authState, member);

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
        broadcastForUrl(stableUrl, hardAuthState, member);
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
        broadcastForUrl(stableUrl, fallbackState, member);
        return;
      }

      const retryState: RecoveryState = {
        phase: "transient-retry",
        attempt,
        nextRetryMs: nextDelay,
      };
      setRecoveryState(retryState);
      broadcastForUrl(stableUrl, retryState, member);

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
    [stableUrl, member]
  );
  runRecoveryRef.current = runRecovery;
  remountForSharedRecoveryRef.current = () => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    onRemountRef.current?.();
  };

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
      broadcastForUrl(stableUrl, s, member);
      return;
    }

    // Processing/finalizing hints — show phase overlay, no probe
    if (hint === "processing") {
      const s: RecoveryState = { phase: "processing" };
      setRecoveryState(s);
      broadcastForUrl(stableUrl, s, member);
      return;
    }
    if (hint === "finalizing") {
      const s: RecoveryState = { phase: "finalizing" };
      setRecoveryState(s);
      broadcastForUrl(stableUrl, s, member);
      return;
    }

    // Record first failure time
    if (firstFailureAtRef.current === null) {
      firstFailureAtRef.current = Date.now();
    }

    const attempt = attemptRef.current;
    attemptRef.current += 1;
    hasFailedRef.current = true;

    // Dedup registration
    if (!isRegisteredRef.current) {
      joinRecovery(stableUrl, member);
      isRegisteredRef.current = true;
    }

    // Only the leader drives recovery probes
    if (!isRecoveryLeader(stableUrl, member)) {
      return;
    }

    void runRecovery(attempt);
  }, [stableUrl, runRecovery, member]);

  // -------------------------------------------------------------------------
  // Public: onMediaLoad
  // -------------------------------------------------------------------------
  const onMediaLoad = React.useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    hasFailedRef.current = false;
    firstFailureAtRef.current = null;
    authRefreshedRef.current = false;
    attemptRef.current = 0;

    const loadedState: RecoveryState = { phase: "loaded" };
    setRecoveryState(loadedState);
    if (stableUrl) {
      // Tell the members first (a failed one retries now), then leave; a
      // promoted member whose state is now `loaded` does not probe.
      broadcastForUrl(stableUrl, loadedState, member);
      if (isRegisteredRef.current) {
        isRegisteredRef.current = false;
        leaveRecovery(stableUrl, member);
      }
    }
  }, [stableUrl, member]);

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

    // The instance restarting the recovery leads it.
    claimRecoveryLead(stableUrl, member);
    isRegisteredRef.current = true;

    const loadingState: RecoveryState = { phase: "loading" };
    setRecoveryState(loadingState);
    broadcastForUrl(stableUrl, loadingState, member);
    onRemountRef.current?.();
  }, [stableUrl, member]);

  return {
    recoveryState,
    onMediaError,
    onMediaLoad,
    manualRetry,
  };
}
