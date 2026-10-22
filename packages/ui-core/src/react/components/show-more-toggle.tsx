'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from './button.js';
import { cn } from '../../lib/utils.js';

type ShowMoreTogglePassthrough = Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'className' | 'onClick' | 'children' | 'aria-expanded' | 'aria-controls'
>;

export interface ShowMoreToggleProps extends ShowMoreTogglePassthrough {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  openLabel: React.ReactNode;
  closeLabel: React.ReactNode;
  controls?: string;
  className?: string;
}

export function ShowMoreToggle({
  expanded,
  onExpandedChange,
  openLabel,
  closeLabel,
  controls,
  className,
  type = 'button',
  ...rest
}: ShowMoreToggleProps) {
  return (
    <Button
      {...rest}
      type={type}
      variant="outline"
      size="sm"
      className={className}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={() => onExpandedChange(!expanded)}
    >
      {expanded ? closeLabel : openLabel}
      <ChevronDown
        aria-hidden="true"
        data-expanded={expanded ? 'true' : 'false'}
        className={cn(
          'ml-1 h-4 w-4 transition-transform motion-reduce:transition-none',
          expanded && 'rotate-180',
        )}
      />
    </Button>
  );
}
