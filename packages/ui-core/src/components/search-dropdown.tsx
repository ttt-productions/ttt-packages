'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { Label } from './label';
import { Loader2, X, Search } from 'lucide-react';
import { cn } from '../lib/utils';

export interface SearchDropdownProps<T> {
  /** Current search value */
  value: string;
  /** Called when search value changes */
  onValueChange: (value: string) => void;
  /** Search results array */
  results: T[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Called when a result is selected */
  onSelect: (result: T) => void;
  /** Called when search is cleared */
  onClear: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Label for the input */
  label?: string;
  /** Custom className */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Icon to show in input (default: Search) */
  icon?: React.ReactNode;
  /** Minimum characters before showing results (default: 3) */
  minChars?: number;
  /** Message to show when no results found */
  emptyMessage?: string;
  /** Custom render function for each result */
  renderResult: (result: T, index: number) => React.ReactNode;
}

/**
 * Generic search dropdown component with debounced input and keyboard navigation.
 * Supports any data type and custom rendering.
 * 
 * @example
 * ```tsx
 * <SearchDropdown<User>
 *   value={searchValue}
 *   onValueChange={setSearchValue}
 *   results={users}
 *   isLoading={isLoading}
 *   error={error}
 *   onSelect={(user) => console.log(user)}
 *   onClear={() => setSearchValue('')}
 *   placeholder="Search users..."
 *   renderResult={(user) => (
 *     <div>{user.displayName}</div>
 *   )}
 * />
 * ```
 */
export function SearchDropdown<T>({
  value,
  onValueChange,
  results,
  isLoading,
  error,
  onSelect,
  onClear,
  placeholder = 'Search...',
  label,
  className,
  disabled = false,
  icon = <Search className="h-4 w-4" />,
  minChars = 3,
  emptyMessage = 'No results found',
  renderResult,
}: SearchDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show dropdown when there are results or loading/error states
  useEffect(() => {
    if (value.length >= minChars && (results.length > 0 || isLoading || error)) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [value, results, isLoading, error, minChars]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          onSelect(results[selectedIndex]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleResultClick = (result: T) => {
    onSelect(result);
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const showDropdown = isOpen && value.length >= minChars;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label && (
        <Label htmlFor="search-input" className="mb-2 block">
          {label}
        </Label>
      )}
      
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
        
        <Input
          ref={inputRef}
          id="search-input"
          type="text"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-10 pr-10"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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

      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {error ? (
            <div className="px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : isLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleResultClick(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={cn(
                  'w-full text-left transition-colors cursor-pointer',
                  'hover:bg-accent focus:bg-accent focus:outline-none',
                  selectedIndex === index && 'bg-accent'
                )}
              >
                {renderResult(result, index)}
              </button>
            ))
          )}
        </div>
      )}
      
      {value.length > 0 && value.length < minChars && (
        <p className="text-xs text-muted-foreground mt-1">
          Type at least {minChars} characters to search
        </p>
      )}
    </div>
  );
}
