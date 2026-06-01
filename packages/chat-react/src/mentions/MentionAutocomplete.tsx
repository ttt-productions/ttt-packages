'use client';

/**
 * Visual autocomplete dropdown for the mention system.
 *
 * Pure presentation — driven entirely by `state` from `useMentionAutocomplete`.
 * The consumer is expected to absolutely-position this near the textarea (or
 * use its caret position via a wrapping container). chat-core does not
 * compute textarea-caret coordinates; that's the consumer's job.
 *
 * Selecting a result fires `onSelect(ref)`. Hovering / arrow-keying updates
 * the highlight via `onHighlight(index)`.
 */

import type { AutocompleteState } from './use-mention-autocomplete.js';
import type { MentionRef } from '@ttt-productions/chat-core';
import { cn } from '@ttt-productions/ui-core';

export interface MentionAutocompleteProps<TKind extends string = string> {
  state: AutocompleteState<TKind>;
  onSelect: (ref: MentionRef<TKind>) => void;
  onHighlight?: (flatIndex: number) => void;
  /** Class name applied to the outer container. */
  className?: string;
}

export function MentionAutocomplete<TKind extends string = string>(
  props: MentionAutocompleteProps<TKind>,
) {
  const { state, onSelect, onHighlight, className } = props;
  if (!state.open) return null;

  const anyResults = state.flatResults.length > 0;
  const anyLoading = state.groups.some((g) => g.loading);

  let flatIndex = 0;

  return (
    <div
      role="listbox"
      aria-label="Mentions"
      className={cn(
        'chat-mention-autocomplete',
        'rounded-md border bg-popover text-popover-foreground shadow-md',
        'max-h-72 overflow-y-auto min-w-[16rem]',
        className,
      )}
    >
      {!anyResults && anyLoading && (
        <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
      )}
      {!anyResults && !anyLoading && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {state.showingRecent ? 'No recent mentions' : 'No matches'}
        </div>
      )}
      {state.groups.map((group) => (
        <div key={group.kind} className="chat-mention-group">
          <div className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">
            {state.showingRecent ? `Recent ${group.label}` : group.label}
          </div>
          {group.loading && group.results.length === 0 && (
            <div className="px-3 pb-2 text-xs text-muted-foreground">Loading…</div>
          )}
          <ul>
            {group.results.map((ref) => {
              const myIndex = flatIndex;
              flatIndex += 1;
              const highlighted = myIndex === state.highlightedIndex;
              return (
                <li key={`${ref.kind}:${ref.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={highlighted}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
                      highlighted && 'bg-accent text-accent-foreground',
                    )}
                    onMouseEnter={() => onHighlight?.(myIndex)}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelect(ref);
                    }}
                  >
                    {group.renderResult ? group.renderResult(ref) : <span>@{ref.displayText}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
