'use client';

import * as React from 'react';

const STORAGE_PREFIX = 'return-scroll:';

export interface ReturnScrollEntry {
  y: number;
  savedAt: number;
}

export interface UseReturnScrollOptions {
  key: string;
  eligible: boolean;
  ready: boolean;
}

export interface UseReturnScrollResult {
  save: () => void;
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function sessionStorageOrNull(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readReturnScroll(key: string): ReturnScrollEntry | null {
  const storage = sessionStorageOrNull();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { y, savedAt } = parsed as { y?: unknown; savedAt?: unknown };
    if (typeof y !== 'number' || !Number.isFinite(y) || y < 0) return null;
    return { y, savedAt: typeof savedAt === 'number' ? savedAt : 0 };
  } catch {
    return null;
  }
}

export function saveReturnScroll(key: string, y?: number): void {
  const storage = sessionStorageOrNull();
  if (!storage) return;
  try {
    const offset = typeof y === 'number' ? y : window.scrollY;
    const entry: ReturnScrollEntry = { y: offset, savedAt: Date.now() };
    storage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // A blocked or full store throws on write; the position is best-effort (RULE-STD-FRONTEND-010).
  }
}

export function clearReturnScroll(key: string): void {
  const storage = sessionStorageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(key));
  } catch {
    // A blocked store throws here, and then it holds nothing to clear.
  }
}

interface Decision {
  key: string;
  y: number | null;
  done: boolean;
}

export function useReturnScroll({
  key,
  eligible,
  ready,
}: UseReturnScrollOptions): UseReturnScrollResult {
  const decisionRef = React.useRef<Decision | null>(null);

  React.useEffect(() => {
    if (decisionRef.current?.key === key) return;
    const entry = readReturnScroll(key);
    if (!entry) {
      decisionRef.current = { key, y: null, done: true };
      return;
    }
    if (!eligible) {
      clearReturnScroll(key);
      decisionRef.current = { key, y: null, done: true };
      return;
    }
    decisionRef.current = { key, y: entry.y, done: false };
  }, [key, eligible]);

  React.useEffect(() => {
    const decision = decisionRef.current;
    if (!decision || decision.key !== key || decision.y === null || decision.done || !ready) return;
    if (typeof window === 'undefined') return;
    const y = decision.y;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior });
      clearReturnScroll(key);
      decision.done = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key, ready]);

  const save = React.useCallback(() => saveReturnScroll(key), [key]);

  return { save };
}
