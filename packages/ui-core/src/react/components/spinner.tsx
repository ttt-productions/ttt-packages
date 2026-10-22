'use client';

import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils.js';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

const SIZE_CLASS: Record<SpinnerSize, string> = {
  xs: 'spinner-xs',
  sm: 'spinner-sm',
  md: 'spinner-md',
  lg: 'spinner-lg',
  xl: 'spinner-xl',
};

function Spinner({ size = 'xs', label, className }: SpinnerProps) {
  if (!label) {
    return <Loader2 className={cn(SIZE_CLASS[size], className)} aria-hidden="true" />;
  }
  return (
    <span role="status" className={cn('inline-flex items-center justify-center', className)}>
      <Loader2 className={SIZE_CLASS[size]} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export { Spinner };
