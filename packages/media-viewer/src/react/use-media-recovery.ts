'use client';

import * as React from 'react';
import type { MediaDiagnosticAdapter, RecoveryState, AssetStatusHint } from '../recovery.js';
import { backoffForAttempt, withinBudget, PHASE_MAX_WAIT_MS } from '../recovery.js';

interface RecoveryMember {
  receive: (state: RecoveryState) => void;
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

function isRecoveringPhase(state: RecoveryState): boolean {
  return (
    state.phase !== 'hard-unavailable' &&
    state.phase !== 'max-wait-fallback' &&
    state.phase !== 'loaded'
  );
}

export interface UseMediaRecoveryOptions {
  url: string | null | undefined;

  adapter?: MediaDiagnosticAdapter;

  isElementVisible?: boolean;

  statusHint?: AssetStatusHint;

  onRemount?: () => void;
}

export interface UseMediaRecoveryResult {
  recoveryState: RecoveryState;

  onMediaError: () => void;

  onMediaLoad: () => void;

  manualRetry: () => void;
}

function isDocumentVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

export function useMediaRecovery({
  url,
  adapter,
  isElementVisible = true,
  statusHint,
  onRemount,
}: UseMediaRecoveryOptions): UseMediaRecoveryResult {
  const [recoveryState, setRecoveryState] = React.useState<RecoveryState>({
    phase: 'idle',
  });
  const recoveryStateRef = React.useRef(recoveryState);
  recoveryStateRef.current = recoveryState;

  const [isDocVisible, setIsDocVisible] = React.useState(isDocumentVisible());

  const adapterRef = React.useRef<MediaDiagnosticAdapter | undefined>(adapter);
  adapterRef.current = adapter;
  const onRemountRef = React.useRef<(() => void) | undefined>(onRemount);
  onRemountRef.current = onRemount;
  const statusHintRef = React.useRef<AssetStatusHint | undefined>(statusHint);
  statusHintRef.current = statusHint;

  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstFailureAtRef = React.useRef<number | null>(null);
  const authRefreshedRef = React.useRef(false);
  const attemptRef = React.useRef(0);
  const isRegisteredRef = React.useRef(false);
  const hasFailedRef = React.useRef(false);

  const stableUrl = url ?? null;

  const runRecoveryRef = React.useRef<(attempt: number) => Promise<void>>(async () => {});
  const remountForSharedRecoveryRef = React.useRef<() => void>(() => {});

  const [member] = React.useState<RecoveryMember>(() => ({
    receive: (state) => {
      recoveryStateRef.current = state;
      setRecoveryState(state);
      if ((state.phase === 'loaded' || state.phase === 'loading') && hasFailedRef.current) {
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

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => setIsDocVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  React.useEffect(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    firstFailureAtRef.current = null;
    authRefreshedRef.current = false;
    attemptRef.current = 0;
    hasFailedRef.current = false;

    setRecoveryState({ phase: 'idle' });

    return () => {
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

  React.useEffect(() => {
    if (!isElementVisible || !isDocVisible) return;
    if (recoveryState.phase !== 'transient-retry') return;
    if (retryTimerRef.current !== null) return;

    const remaining = Math.max(0, recoveryState.nextRetryMs);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      onRemountRef.current?.();
    }, remaining);
  }, [isElementVisible, isDocVisible, recoveryState]);

  React.useEffect(() => {
    if (recoveryState.phase !== 'processing' && recoveryState.phase !== 'finalizing') {
      return;
    }
    const timer = setTimeout(() => {
      const fallbackState: RecoveryState = { phase: 'max-wait-fallback' };
      setRecoveryState(fallbackState);
      if (stableUrl) broadcastForUrl(stableUrl, fallbackState, member);
    }, PHASE_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [recoveryState.phase, stableUrl, member]);

  const visibilityRef = React.useRef({ isElementVisible, isDocVisible });
  visibilityRef.current = { isElementVisible, isDocVisible };

  const runRecovery = React.useCallback(
    async (attempt: number) => {
      if (!stableUrl) return;

      const currentAdapter = adapterRef.current;
      const hint = statusHintRef.current;

      let diagnosis: import('../recovery.js').DiagnosisResult;

      if (!currentAdapter?.probe) {
        diagnosis = { kind: 'transient' };
      } else {
        try {
          diagnosis = await currentAdapter.probe(stableUrl);
        } catch {
          diagnosis = { kind: 'transient' };
        }
      }

      if (diagnosis.kind === 'hard') {
        const hardState: RecoveryState = { phase: 'hard-unavailable' };
        setRecoveryState(hardState);
        broadcastForUrl(stableUrl, hardState, member);
        return;
      }

      if (diagnosis.kind === 'auth') {
        if (!authRefreshedRef.current) {
          authRefreshedRef.current = true;
          const authState: RecoveryState = { phase: 'auth-retry' };
          setRecoveryState(authState);
          broadcastForUrl(stableUrl, authState, member);

          try {
            if (hint !== 'failed' && hint !== 'rejected') {
              await currentAdapter?.refreshSession?.();
              await currentAdapter?.refreshGrant?.(stableUrl);
            }
          } catch {}

          onRemountRef.current?.();
          return;
        }
        const hardAuthState: RecoveryState = {
          phase: 'hard-unavailable',
          reason: 'auth',
        };
        setRecoveryState(hardAuthState);
        broadcastForUrl(stableUrl, hardAuthState, member);
        return;
      }

      const nextDelay = backoffForAttempt(attempt);
      const nextRetryAt = Date.now() + nextDelay;

      if (
        firstFailureAtRef.current !== null &&
        !withinBudget(firstFailureAtRef.current, nextRetryAt)
      ) {
        const fallbackState: RecoveryState = { phase: 'max-wait-fallback' };
        setRecoveryState(fallbackState);
        broadcastForUrl(stableUrl, fallbackState, member);
        return;
      }

      const retryState: RecoveryState = {
        phase: 'transient-retry',
        attempt,
        nextRetryMs: nextDelay,
      };
      setRecoveryState(retryState);
      broadcastForUrl(stableUrl, retryState, member);

      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const { isElementVisible: elVis, isDocVisible: docVis } = visibilityRef.current;
        if (!elVis || !docVis) {
          return;
        }
        onRemountRef.current?.();
      }, nextDelay);
    },
    [stableUrl, member],
  );
  runRecoveryRef.current = runRecovery;
  remountForSharedRecoveryRef.current = () => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    onRemountRef.current?.();
  };

  const onMediaError = React.useCallback(() => {
    if (!stableUrl) return;

    const hint = statusHintRef.current;

    if (hint === 'failed' || hint === 'rejected') {
      const s: RecoveryState = { phase: 'hard-unavailable', reason: hint };
      setRecoveryState(s);
      broadcastForUrl(stableUrl, s, member);
      return;
    }

    if (hint === 'processing') {
      const s: RecoveryState = { phase: 'processing' };
      setRecoveryState(s);
      broadcastForUrl(stableUrl, s, member);
      return;
    }
    if (hint === 'finalizing') {
      const s: RecoveryState = { phase: 'finalizing' };
      setRecoveryState(s);
      broadcastForUrl(stableUrl, s, member);
      return;
    }

    if (firstFailureAtRef.current === null) {
      firstFailureAtRef.current = Date.now();
    }

    const attempt = attemptRef.current;
    attemptRef.current += 1;
    hasFailedRef.current = true;

    if (!isRegisteredRef.current) {
      joinRecovery(stableUrl, member);
      isRegisteredRef.current = true;
    }

    if (!isRecoveryLeader(stableUrl, member)) {
      return;
    }

    void runRecovery(attempt);
  }, [stableUrl, runRecovery, member]);

  const onMediaLoad = React.useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    hasFailedRef.current = false;
    firstFailureAtRef.current = null;
    authRefreshedRef.current = false;
    attemptRef.current = 0;

    const loadedState: RecoveryState = { phase: 'loaded' };
    setRecoveryState(loadedState);
    if (stableUrl) {
      broadcastForUrl(stableUrl, loadedState, member);
      if (isRegisteredRef.current) {
        isRegisteredRef.current = false;
        leaveRecovery(stableUrl, member);
      }
    }
  }, [stableUrl, member]);

  const manualRetry = React.useCallback(() => {
    if (!stableUrl) return;

    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    firstFailureAtRef.current = null;
    authRefreshedRef.current = false;
    attemptRef.current = 0;

    claimRecoveryLead(stableUrl, member);
    isRegisteredRef.current = true;

    const loadingState: RecoveryState = { phase: 'loading' };
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
