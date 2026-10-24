'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '../../lib/utils.js';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string;
}

const DEFAULT_MAX = 100;

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, max = DEFAULT_MAX, indicatorClassName, ...props }, ref) => {
    const known = typeof value === 'number' && Number.isFinite(value);
    const clamped = known ? Math.min(Math.max(value, 0), max) : null;
    const percent = clamped === null || max <= 0 ? 0 : (clamped / max) * 100;
    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={clamped}
        max={max}
        className={cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full w-full flex-1 bg-primary transition-transform duration-[var(--motion-base)] ease-[var(--motion-ease)]',
            indicatorClassName,
          )}
          style={{ transform: `translateX(-${100 - percent}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
