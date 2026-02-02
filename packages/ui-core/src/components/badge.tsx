"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        professions:
          "bg-[hsl(var(--card))] border-[hsl(var(--brand-primary))] text-[hsl(var(--brand-primary-deep))] border-2",

        // NEW: semantic status pills (colors come from CSS vars)
        status:
          "border-[hsl(var(--pill-border, var(--border)))] bg-[hsl(var(--pill-bg, var(--muted)))] text-[hsl(var(--pill-fg, var(--foreground)))]",
      },

      // NEW: specific status mappings -> theme-core vars (with fallbacks)
      status: {
        completed:
          "border-[hsl(var(--pill-completed-border, var(--brand-primary)))] bg-[hsl(var(--pill-completed-bg, var(--brand-primary)))] text-[hsl(var(--pill-completed-fg, var(--brand-primary-foreground, var(--primary-foreground))))]",
        scheduled:
          "border-[hsl(var(--pill-scheduled-border, var(--brand-secondary, var(--border))))] bg-[hsl(var(--pill-scheduled-bg, var(--card)))] text-[hsl(var(--pill-scheduled-fg, var(--brand-primary-deep, var(--foreground))))]",
        in_progress:
          "border-[hsl(var(--pill-inprogress-border, var(--brand-accent, var(--border))))] bg-[hsl(var(--pill-inprogress-bg, var(--brand-accent, var(--accent))))] text-[hsl(var(--pill-inprogress-fg, var(--brand-accent-foreground, var(--accent-foreground))))]",
        pending:
          "border-[hsl(var(--pill-pending-border, var(--border)))] bg-[hsl(var(--pill-pending-bg, var(--muted)))] text-[hsl(var(--pill-pending-fg, var(--foreground)))]",
        cancelled:
          "border-[hsl(var(--pill-cancelled-border, var(--destructive)))] bg-[hsl(var(--pill-cancelled-bg, var(--destructive)))] text-[hsl(var(--pill-cancelled-fg, var(--destructive-foreground)))]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, status, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, status }), className)} {...props} />;
}

export { Badge, badgeVariants };
