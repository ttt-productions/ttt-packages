'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { Input } from './input.js';
import { Label } from './label.js';
import { X, Search } from 'lucide-react';
import { Spinner } from './spinner.js';
import { cn } from '../../lib/utils.js';

function defaultResultsAnnouncement(count: number): string {
  return count === 1 ? '1 result' : `${count} results`;
}

export interface SearchDropdownProps<T> {
  value: string;
  onValueChange: (value: string) => void;
  results: T[];
  isLoading: boolean;
  error: unknown;
  renderError: (error: unknown) => React.ReactNode;
  onSelect: (result: T) => void;
  onClear?: () => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  minChars: number;
  maxLength: number;
  isSearchable: (value: string) => boolean;
  emptyMessage?: string;
  resultsAnnouncement?: (count: number) => string;
  renderResult: (result: T, index: number) => React.ReactNode;
}

export function SearchDropdown<T>({
  value,
  onValueChange,
  results,
  isLoading,
  error,
  renderError,
  onSelect,
  onClear,
  placeholder = 'Search...',
  label,
  className,
  disabled = false,
  icon = <Search className="h-4 w-4" />,
  minChars,
  maxLength,
  isSearchable,
  emptyMessage = 'No results found',
  resultsAnnouncement = defaultResultsAnnouncement,
  renderResult,
}: SearchDropdownProps<T>) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const labelId = `${baseId}-label`;
  const listboxId = `${baseId}-listbox`;
  const panelId = `${baseId}-panel`;
  const hintId = `${baseId}-hint`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<{ value: string; index: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const searchable = isSearchable(value);
  const isOpen = searchable && dismissedFor !== value;
  const failed = error !== null && error !== undefined;
  const showOptions = isOpen && !failed && !isLoading && results.length > 0;
  const activeIndex =
    showOptions && highlight && highlight.value === value && highlight.index < results.length
      ? highlight.index
      : -1;
  const showHint = value.length > 0 && !searchable;
  const announcement =
    !isOpen || failed
      ? ''
      : isLoading
        ? 'Searching...'
        : results.length === 0
          ? emptyMessage
          : resultsAnnouncement(results.length);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDismissedFor(value);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, value]);

  const select = (result: T) => {
    onSelect(result);
    setDismissedFor(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        if (!searchable) return;
        e.preventDefault();
        if (!isOpen) {
          setDismissedFor(null);
          return;
        }
        if (!showOptions) return;
        setHighlight({
          value,
          index: activeIndex < results.length - 1 ? activeIndex + 1 : activeIndex,
        });
        break;
      case 'ArrowUp':
        if (!showOptions) return;
        e.preventDefault();
        setHighlight({ value, index: activeIndex > 0 ? activeIndex - 1 : 0 });
        break;
      case 'Enter':
        if (activeIndex < 0) return;
        e.preventDefault();
        select(results[activeIndex]);
        break;
      case 'Escape':
        // Escape never falls through to the search field's own clear, which would skip onClear.
        e.preventDefault();
        if (isOpen) setDismissedFor(value);
        else if (value) handleClear();
        break;
    }
  };

  const handleClear = () => {
    onValueChange('');
    onClear?.();
    setDismissedFor(null);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label && (
        <Label id={labelId} htmlFor={inputId} className="mb-2 block">
          {label}
        </Label>
      )}

      <div className="relative">
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        >
          {icon}
        </div>

        <Input
          ref={inputRef}
          id={inputId}
          type="search"
          maxLength={maxLength}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? (showOptions ? listboxId : panelId) : undefined}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-describedby={showHint ? hintId : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => {
            setDismissedFor(null);
            onValueChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Spinner size="xs" className="text-muted-foreground" />
          ) : value ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {isOpen && (
        <div
          id={panelId}
          className="absolute z-50 w-full mt-1 bg-popover border rounded-md elevation-raised max-h-60 overflow-auto"
        >
          {failed ? (
            renderError(error)
          ) : isLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Spinner size="xs" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</div>
          ) : (
            <div
              role="listbox"
              id={listboxId}
              aria-labelledby={label ? labelId : undefined}
              aria-label={label ? undefined : placeholder}
            >
              {results.map((result, index) => (
                <div
                  key={index}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(result)}
                  onMouseEnter={() => setHighlight({ value, index })}
                  className={cn(
                    'w-full text-left transition-colors cursor-pointer hover:bg-accent',
                    index === activeIndex && 'bg-accent',
                  )}
                >
                  {renderResult(result, index)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {showHint && (
        <p id={hintId} className="text-xs text-muted-foreground mt-1">
          Type at least {minChars} characters to search
        </p>
      )}
    </div>
  );
}
