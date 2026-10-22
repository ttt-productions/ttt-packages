'use client';

import * as React from 'react';
import { cn } from '../../../lib/utils.js';
import { useMediaQuery } from '../../hooks/use-media-query.js';

export type MaxWidthOption =
  'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';

export interface ScreenAdaptiveViewProps {
  children: React.ReactNode;

  lgContent?: React.ReactNode;

  xlContent?: React.ReactNode;

  lgMaxWidth?: MaxWidthOption;

  xlMaxWidth?: MaxWidthOption;

  className?: string;

  innerClassName?: string;
}

function widthClass(opt: MaxWidthOption | undefined) {
  switch (opt) {
    case 'none':
      return 'screen-max-w-none';
    case 'sm':
      return 'screen-max-w-sm';
    case 'md':
      return 'screen-max-w-md';
    case 'lg':
      return 'screen-max-w-lg';
    case 'xl':
      return 'screen-max-w-xl';
    case '2xl':
      return 'screen-max-w-2xl';
    case '3xl':
      return 'screen-max-w-3xl';
    case '4xl':
      return 'screen-max-w-4xl';
    case '5xl':
      return 'screen-max-w-5xl';
    case '6xl':
      return 'screen-max-w-6xl';
    case '7xl':
      return 'screen-max-w-7xl';
    case 'full':
      return 'screen-max-w-full';
    default:
      return 'screen-max-w-6xl';
  }
}

export function ScreenAdaptiveView({
  children,
  lgContent,
  xlContent,
  lgMaxWidth = '4xl',
  xlMaxWidth = '6xl',
  className,
  innerClassName,
}: ScreenAdaptiveViewProps) {
  const isLg = useMediaQuery('(min-width: 1024px)');
  const isXl = useMediaQuery('(min-width: 1280px)');

  // SSR-safe: base children render until hydration, then lg/xl content swaps in.
  const contentToShow =
    isXl && xlContent !== undefined && xlContent !== null
      ? xlContent
      : isLg && lgContent !== undefined && lgContent !== null
        ? lgContent
        : children;

  const sizeClass = isXl
    ? widthClass(xlMaxWidth)
    : isLg
      ? widthClass(lgMaxWidth)
      : 'screen-max-w-full';

  return (
    <div className={cn('screen-adaptive-root', className)}>
      <div className={cn('screen-adaptive-inner', sizeClass, innerClassName)}>{contentToShow}</div>
    </div>
  );
}
