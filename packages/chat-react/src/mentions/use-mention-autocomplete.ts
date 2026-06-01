'use client';

/**
 * Composer-side mention autocomplete state hook.
 *
 * Detects when the user types the trigger character (default `@`) inside the
 * provided textarea, captures the live query (the text between the trigger
 * and the cursor), debounces searches across all configured providers, and
 * tracks the anchor positions of inserted mentions so the composer can
 * convert display text back to wire tokens on send.
 *
 * Returns an `AutocompleteState` value tailored for the `<MentionAutocomplete>`
 * UI component, plus an `insertMention` action and a `getValueWithTokens`
 * accessor the composer calls on send.
 *
 * Generic over `TKind` and `TContext`; chat-core inspects neither.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { formatMentionToken } from '@ttt-productions/chat-core';
import type {
  MentionAnchor,
  MentionRef,
  RecentMentionsAdapter,
} from '@ttt-productions/chat-core';
import type { RenderableMentionProvider } from '../types.js';

export type AutocompleteResultGroup<TKind extends string = string> = {
  kind: TKind;
  label: string;
  results: MentionRef<TKind>[];
  /** True if `search` is in flight for this provider. */
  loading: boolean;
  /** Provider-supplied custom renderer for individual results, if any. */
  renderResult?: (ref: MentionRef<TKind>) => import('react').ReactNode;
};

export type AutocompleteState<TKind extends string = string> = {
  /** True iff the dropdown should be visible. */
  open: boolean;
  /** Current query text (everything after the trigger up to the cursor). */
  query: string;
  /** Results grouped by provider, in the order the consumer passed providers. */
  groups: AutocompleteResultGroup<TKind>[];
  /** When true, groups are recent picks (`getRecent`) rather than search results. */
  showingRecent: boolean;
  /** Index of the currently highlighted result, flattened across all groups. */
  highlightedIndex: number;
  /** Flat array of all results in display order. Used internally for keyboard nav. */
  flatResults: MentionRef<TKind>[];
};

export interface UseMentionAutocompleteArgs<TKind extends string, TContext> {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Current textarea value (controlled). */
  value: string;
  /** Setter for the textarea value. */
  onChange: (next: string) => void;
  /** Providers in display order. Empty list disables the system entirely. */
  providers: RenderableMentionProvider<TKind, TContext>[];
  /** Consumer-controlled context passed to each provider's `search`. */
  context: TContext;
  /** Optional recent-mentions adapter. */
  recent?: RecentMentionsAdapter<TKind>;
  /** Trigger character. Defaults to `'@'`. Must be exactly one character. */
  trigger?: string;
  /**
   * Minimum query length to fire `search`. Below this, recent picks are shown
   * (if `recent` is supplied) or the dropdown stays empty. Default: 0 (search
   * fires immediately on trigger).
   */
  minQueryLength?: number;
  /** Debounce window in ms for search calls. Default: 200. */
  searchDebounceMs?: number;
}

export interface UseMentionAutocompleteResult<TKind extends string = string> {
  state: AutocompleteState<TKind>;
  /** Handle keydown from the textarea — returns true if the event was handled. */
  handleKeyDown: (event: import('react').KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Programmatically insert a mention at the trigger position (called by the autocomplete UI). */
  insertMention: (ref: MentionRef<TKind>) => void;
  /**
   * Returns the current textarea value with all tracked mention anchors
   * substituted back to wire tokens. Call this from the composer's send path.
   */
  getValueWithTokens: () => string;
  /** Anchor list — exposed for tests and consumers that need the raw positions. */
  anchors: MentionAnchor<TKind>[];
  /** Close the dropdown imperatively (e.g. on send). */
  close: () => void;
}

function isWordBoundary(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

export function useMentionAutocomplete<TKind extends string, TContext>(
  args: UseMentionAutocompleteArgs<TKind, TContext>,
): UseMentionAutocompleteResult<TKind> {
  const {
    textareaRef,
    value,
    onChange,
    providers,
    context,
    recent,
    trigger = '@',
    minQueryLength = 0,
    searchDebounceMs = 200,
  } = args;

  if (trigger.length !== 1) {
    throw new Error(`useMentionAutocomplete: trigger must be a single character, got ${JSON.stringify(trigger)}`);
  }

  const [open, setOpen] = useState(false);
  const [triggerIndex, setTriggerIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<AutocompleteResultGroup<TKind>[]>([]);
  const [showingRecent, setShowingRecent] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [anchors, setAnchors] = useState<MentionAnchor<TKind>[]>([]);

  // Refs for the latest values so the debounced search reads fresh.
  const valueRef = useRef(value);
  const triggerIndexRef = useRef(triggerIndex);
  const providersRef = useRef(providers);
  const contextRef = useRef(context);
  useEffect(() => {
    valueRef.current = value;
    triggerIndexRef.current = triggerIndex;
    providersRef.current = providers;
    contextRef.current = context;
  });

  const flatResults = useMemo(
    () => groups.flatMap((g) => g.results),
    [groups],
  );

  const close = useCallback(() => {
    setOpen(false);
    setTriggerIndex(null);
    setQuery('');
    setGroups([]);
    setHighlightedIndex(0);
    setShowingRecent(false);
  }, []);

  /**
   * Detect trigger state based on current value + cursor position.
   * Called from useEffect on value changes.
   */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    if (cursor === null) return;

    // Walk backwards from the cursor to find the trigger character, stopping
    // at a whitespace boundary or the start of the string.
    let i = cursor - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === trigger) {
        // Trigger only counts if the character before it is whitespace or BoL.
        if (i === 0 || /\s/.test(value[i - 1])) {
          const q = value.slice(i + 1, cursor);
          // If the slice contains whitespace, the trigger run has been broken.
          if (/\s/.test(q)) {
            close();
            return;
          }
          setTriggerIndex(i);
          setQuery(q);
          setOpen(true);
          setHighlightedIndex(0);
          return;
        }
        // Inline `@` not at word boundary — not a trigger.
        close();
        return;
      }
      if (/\s/.test(ch)) {
        close();
        return;
      }
      i -= 1;
    }
    close();
    // We intentionally watch value AND the textarea's cursor position via the
    // event chain — selectionStart updates synchronously with input/key events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, trigger]);

  /**
   * Recompute anchor offsets when the textarea value changes externally
   * (e.g. user deletes text). Drop anchors whose displayed text no longer
   * matches the underlying displayText at their range.
   */
  useEffect(() => {
    setAnchors((prev) =>
      prev.filter((a) => {
        const expected = `${trigger}${a.ref.displayText}`;
        return value.slice(a.start, a.end) === expected;
      }),
    );
  }, [value, trigger]);

  /**
   * Search: fires whenever query opens / changes. Debounced. Cancels in-flight
   * via AbortController.
   */
  useEffect(() => {
    if (!open) {
      setGroups([]);
      setShowingRecent(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    if (query.length < minQueryLength) {
      // Below threshold: show recent picks if adapter supplied.
      if (recent) {
        Promise.resolve(recent.getRecent())
          .then((items) => {
            if (cancelled) return;
            // Group recent by kind, preserving provider order.
            const byKind = new Map<TKind, MentionRef<TKind>[]>();
            for (const item of items) {
              const arr = byKind.get(item.kind) ?? [];
              arr.push(item);
              byKind.set(item.kind, arr);
            }
            const recentGroups: AutocompleteResultGroup<TKind>[] = providers
              .map((p) => ({
                kind: p.kind,
                label: p.label,
                results: byKind.get(p.kind) ?? [],
                loading: false,
                renderResult: p.renderResult,
              }))
              .filter((g) => g.results.length > 0);
            setGroups(recentGroups);
            setShowingRecent(true);
            setHighlightedIndex(0);
          })
          .catch(() => {
            if (!cancelled) {
              setGroups([]);
              setShowingRecent(false);
            }
          });
      } else {
        setGroups([]);
        setShowingRecent(false);
      }
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    setShowingRecent(false);
    // Initial: each group loading.
    setGroups(
      providers.map((p) => ({
        kind: p.kind,
        label: p.label,
        results: [],
        loading: true,
        renderResult: p.renderResult,
      })),
    );

    const timer = setTimeout(() => {
      providers.forEach((provider, i) => {
        provider
          .search({ query, context, signal: controller.signal })
          .then((results) => {
            if (cancelled) return;
            setGroups((prev) => {
              const next = prev.slice();
              next[i] = { ...next[i], results, loading: false };
              return next;
            });
          })
          .catch(() => {
            if (cancelled) return;
            setGroups((prev) => {
              const next = prev.slice();
              next[i] = { ...next[i], results: [], loading: false };
              return next;
            });
          });
      });
    }, searchDebounceMs);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
    // We deliberately depend on `query` + `open` only; `providers` / `context`
    // are read via refs to avoid re-firing on identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, minQueryLength, searchDebounceMs, recent]);

  const insertMention = useCallback(
    (ref: MentionRef<TKind>) => {
      const ti = triggerIndexRef.current;
      if (ti === null) return;
      const ta = textareaRef.current;
      if (!ta) return;

      const before = valueRef.current.slice(0, ti);
      // Cursor at point of insertion — current selection end captures the
      // typed query.
      const cursor = ta.selectionStart ?? ti + 1 + query.length;
      const after = valueRef.current.slice(cursor);
      const insertion = `${trigger}${ref.displayText}`;
      // Add a trailing space unless there is an explicit whitespace character
      // immediately after the insertion point (don't double-space). End-of-string
      // (after[0] === undefined) always adds a space so the cursor clears the
      // trigger run and the autocomplete doesn't re-open.
      const trailing = (after[0] !== undefined && isWordBoundary(after[0])) ? '' : ' ';
      const next = `${before}${insertion}${trailing}${after}`;

      const anchorStart = ti;
      const anchorEnd = ti + insertion.length;

      onChange(next);
      setAnchors((prev) => {
        // Shift any later anchors by the net change in length.
        const delta = insertion.length + trailing.length - (cursor - ti);
        const shifted = prev.map((a) =>
          a.start >= cursor ? { ...a, start: a.start + delta, end: a.end + delta } : a,
        );
        return [...shifted, { start: anchorStart, end: anchorEnd, ref }];
      });
      // Fire recent-use without awaiting.
      if (recent?.recordUse) {
        try {
          const result = recent.recordUse(ref);
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            (result as Promise<unknown>).catch(() => undefined);
          }
        } catch {
          // Swallow — recent-use is best-effort.
        }
      }
      close();
      // Move cursor to just after the inserted mention (+ optional trailing space).
      // Defer so the controlled value flush completes first.
      const newCursor = anchorEnd + trailing.length;
      queueMicrotask(() => {
        const t = textareaRef.current;
        if (t) {
          t.focus();
          t.setSelectionRange(newCursor, newCursor);
        }
      });
    },
    [trigger, query.length, onChange, recent, close, textareaRef],
  );

  const handleKeyDown = useCallback(
    (event: import('react').KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!open) return false;
      if (flatResults.length === 0 && event.key !== 'Escape') {
        // Allow Escape to close even with no results; otherwise pass through.
        return false;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((i) => (i + 1) % Math.max(flatResults.length, 1));
          return true;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(
            (i) => (i - 1 + flatResults.length) % Math.max(flatResults.length, 1),
          );
          return true;
        case 'Enter':
        case 'Tab': {
          if (flatResults.length === 0) return false;
          event.preventDefault();
          const pick = flatResults[Math.min(highlightedIndex, flatResults.length - 1)];
          if (pick) insertMention(pick);
          return true;
        }
        case 'Escape':
          event.preventDefault();
          close();
          return true;
        default:
          return false;
      }
    },
    [open, flatResults, highlightedIndex, insertMention, close],
  );

  const getValueWithTokens = useCallback(() => {
    if (anchors.length === 0) return valueRef.current;
    // Sort anchors by start ASC, then substitute. Walk the value left → right
    // building the result with mention tokens swapped in at each anchor's range.
    const sorted = [...anchors].sort((a, b) => a.start - b.start);
    const v = valueRef.current;
    let out = '';
    let cursor = 0;
    for (const a of sorted) {
      if (a.start < cursor) continue; // overlapping; drop (shouldn't happen)
      out += v.slice(cursor, a.start);
      out += formatMentionToken(a.ref);
      cursor = a.end;
    }
    out += v.slice(cursor);
    return out;
  }, [anchors]);

  const state: AutocompleteState<TKind> = {
    open,
    query,
    groups,
    showingRecent,
    highlightedIndex,
    flatResults,
  };

  return { state, handleKeyDown, insertMention, getValueWithTokens, anchors, close };
}
