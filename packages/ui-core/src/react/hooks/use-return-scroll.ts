'use client';

import * as React from 'react';
import { readStoredValue, writeStoredValue } from '@ttt-productions/storage-core';

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

export function readReturnScroll(key: string): ReturnScrollEntry | null {
  const raw = readStoredValue(key, 'session');
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { y, savedAt } = parsed as { y?: unknown; savedAt?: unknown };
  if (typeof y !== 'number' || !Number.isFinite(y) || y < 0) return null;
  return { y, savedAt: typeof savedAt === 'number' ? savedAt : 0 };
}

export function saveReturnScroll(key: string, y?: number): void {
  if (typeof window === 'undefined') return;
  const offset = typeof y === 'number' ? y : window.scrollY;
  const entry: ReturnScrollEntry = { y: offset, savedAt: Date.now() };
  writeStoredValue(key, JSON.stringify(entry), 'session');
}

export function clearReturnScroll(key: string): void {
  writeStoredValue(key, null, 'session');
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
