'use client';

import * as React from 'react';
import { ChevronUp } from 'lucide-react';
import { Button, type ButtonProps } from './button.js';
import { cn } from '../../lib/utils.js';

type ScrollToTopButtonPassthrough = Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'className' | 'onClick' | 'aria-label' | 'children'
>;

export interface ScrollToTopButtonProps extends ScrollToTopButtonPassthrough {
  threshold?: number;
  ariaLabel?: string;
  className?: string;
  icon?: React.ReactNode;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  /** An explicit JS `behavior: "smooth"` ignores a CSS `scroll-behavior` override, so a reduced-motion mode passes "auto". */
  scrollBehavior?: ScrollBehavior;
}

export function ScrollToTopButton({
  threshold = 400,
  ariaLabel = 'Scroll to top',
  className,
  icon,
  variant,
  size = 'icon',
  scrollBehavior = 'smooth',
  ...rest
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const toggle = () => setIsVisible(window.scrollY > threshold);
    toggle();
    window.addEventListener('scroll', toggle, { passive: true });
    return () => window.removeEventListener('scroll', toggle);
  }, [threshold]);

  const onClick = () => window.scrollTo({ top: 0, behavior: scrollBehavior });

  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-full elevation-raised transition-opacity duration-[var(--motion-base)] ease-[var(--motion-ease)]',
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className,
      )}
    >
      {icon ?? <ChevronUp className="h-5 w-5" />}
    </Button>
  );
}
