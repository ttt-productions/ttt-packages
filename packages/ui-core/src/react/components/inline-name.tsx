'use client';

import { cn } from '../../lib/utils.js';

export interface InlineNameProps {
  name: string;
  className?: string;
}

function InlineName({ name, className }: InlineNameProps) {
  return <span className={cn('inline-name', className)}>{name}</span>;
}

export { InlineName };
