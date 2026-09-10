"use client";

// Return-scroll: bring a list back to where the user left it after a REAL route change.
//
// A same-page view swap keeps its component mounted and can restore from a ref; a list
// whose detail pages have their own URLs unmounts, so the offset has to survive in
// per-tab storage and the restore has to wait until the list is displayed at its real
// height again. This hook is the ONE owner of that mechanism. It knows nothing about
// what the list is — the caller supplies a canonical key, decides eligibility once at
// mount, and reports readiness.
//
// Contract (every rule below is tested):
//   - `save()` writes { y, savedAt } for `key` — call it immediately before navigating
//     away (inside any guarded-navigation callback, so a cancelled leave writes nothing).
//   - `eligible` is latched per key the first time the hook sees that key. Not eligible
//     ⇒ the entry is deleted immediately and permanently for that key; a later flip
//     of `eligible` or `ready` never re-arms the restore.
//   - `ready` ⇒ the restore fires ONCE, in a requestAnimationFrame, `behavior: "instant"`,
//     then consumes the entry. The scheduled frame is cancelled on unmount or key change.
//     React Strict Mode's mount/unmount/mount cancels and reschedules, so exactly one
//     scroll happens and the entry is consumed exactly once.
//   - Blocked, unavailable, or malformed storage is a silent no-op.

import * as React from "react";

const STORAGE_PREFIX = "return-scroll:";

export interface ReturnScrollEntry {
  /** The saved `window.scrollY`. */
  y: number;
  /** Epoch ms at save time (diagnostic; the caller decides eligibility, not the hook). */
  savedAt: number;
}

export interface UseReturnScrollOptions {
  /** The caller's CANONICAL list URL — equivalent list states must give the same key. */
  key: string;
  /** Decided by the caller ONCE at mount (e.g. "the list's data was already cached on first render"). */
  eligible: boolean;
  /** The list is displayed at its real height: data present, no error surface in its place. */
  ready: boolean;
}

export interface UseReturnScrollResult {
  /** Record the current window offset for `key`. Call right before navigating away. */
  save: () => void;
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function sessionStorageOrNull(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** The stored entry for `key`, or null when absent, unreadable, or malformed. */
export function readReturnScroll(key: string): ReturnScrollEntry | null {
  const storage = sessionStorageOrNull();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { y, savedAt } = parsed as { y?: unknown; savedAt?: unknown };
    if (typeof y !== "number" || !Number.isFinite(y) || y < 0) return null;
    return { y, savedAt: typeof savedAt === "number" ? savedAt : 0 };
  } catch {
    return null;
  }
}

/** Record `y` (default: the current `window.scrollY`) for `key`. No-op without storage. */
export function saveReturnScroll(key: string, y?: number): void {
  const storage = sessionStorageOrNull();
  if (!storage) return;
  try {
    const offset = typeof y === "number" ? y : window.scrollY;
    const entry: ReturnScrollEntry = { y: offset, savedAt: Date.now() };
    storage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    /* storage blocked or full — nothing to restore later, which is the honest outcome */
  }
}

/** Drop the entry for `key` (e.g. the list changed underneath the saved offset). */
export function clearReturnScroll(key: string): void {
  const storage = sessionStorageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(key));
  } catch {
    /* nothing to clear */
  }
}

interface Decision {
  key: string;
  /** The offset to restore, or null when this key's return is not restorable. */
  y: number | null;
  done: boolean;
}

export function useReturnScroll({ key, eligible, ready }: UseReturnScrollOptions): UseReturnScrollResult {
  const decisionRef = React.useRef<Decision | null>(null);

  // Decide ONCE per key, the first time the hook sees it. Effects may read and write refs;
  // the decision is latched, so a later `eligible` flip finds it already made and returns.
  React.useEffect(() => {
    if (decisionRef.current?.key === key) return;
    const entry = readReturnScroll(key);
    if (!entry) {
      decisionRef.current = { key, y: null, done: true };
      return;
    }
    if (!eligible) {
      // A cold return: nothing cached to restore against. Discard permanently for this visit.
      clearReturnScroll(key);
      decisionRef.current = { key, y: null, done: true };
      return;
    }
    decisionRef.current = { key, y: entry.y, done: false };
  }, [key, eligible]);

  // Restore once the list is displayed at its real height. The frame is cancelled on unmount
  // or key change; Strict Mode's re-run reschedules it, so exactly one scroll happens.
  React.useEffect(() => {
    const decision = decisionRef.current;
    if (!decision || decision.key !== key || decision.y === null || decision.done || !ready) return;
    if (typeof window === "undefined") return;
    const y = decision.y;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
      clearReturnScroll(key);
      decision.done = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key, ready]);

  const save = React.useCallback(() => saveReturnScroll(key), [key]);

  return { save };
}
