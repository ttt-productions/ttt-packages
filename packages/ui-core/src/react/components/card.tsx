'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils.js';

// A page variant carries theme-core's page-card recipe class in place of the built-in utilities it
// would otherwise lose to: the utilities layer outranks every layered sheet.

const cardVariants = cva('', {
  variants: {
    variant: {
      default: 'rounded-lg border-2 card-border bg-card text-card-foreground',
      page: 'page-card',
    },
  },
  defaultVariants: { variant: 'default' },
});

const cardHeaderVariants = cva('flex flex-col space-y-1.5', {
  variants: {
    variant: {
      default: 'p-6',
      page: 'page-card-header',
      pageLeft: 'page-card-header-left',
    },
  },
  defaultVariants: { variant: 'default' },
});

const cardTitleVariants = cva('break-words', {
  variants: {
    variant: {
      default: 'text-2xl font-semibold leading-none tracking-tight card-title',
      page: 'page-card-title',
    },
  },
  defaultVariants: { variant: 'default' },
});

const cardContentVariants = cva('', {
  variants: {
    variant: {
      default: 'p-6 pt-0',
      page: 'page-card-content',
    },
  },
  defaultVariants: { variant: 'default' },
});

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardHeaderVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardHeaderVariants({ variant }), className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement> & VariantProps<typeof cardTitleVariants>
>(({ className, variant, ...props }, ref) => (
  <h3 ref={ref} className={cn(cardTitleVariants({ variant }), className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('break-words card-description', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardContentVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardContentVariants({ variant }), className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
