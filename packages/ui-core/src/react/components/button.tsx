"use client"

import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils.js"
import { Spinner } from "./spinner.js"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "button-default bg-primary text-primary-foreground hover:bg-primary/90 border-2 border-[hsl(var(--brand-primary-deep))]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 border-2 border-[hsl(var(--destructive-border))]",
        success:
          "bg-[color:var(--button-success)] text-[hsl(var(--success-foreground))] hover:bg-[color:var(--button-success)]/90 border-2 border-[hsl(var(--status-success-border))]",
        outline:
          "border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-2 border-border",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        inverted:
          "bg-[hsl(var(--inverted-background))] text-[hsl(var(--inverted-foreground))] hover:bg-[hsl(var(--inverted-background))]/90 border-2 border-[hsl(var(--inverted-border))]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Async work this button started is in flight. The button disables itself — so
   * neither a repeat click nor an implicit form resubmit can fire — sets
   * `aria-busy`, and shows the canonical spinner: an icon button (`size="icon"`)
   * swaps its icon for it; any other button shows it in place of its `icon`.
   */
  pending?: boolean
  /** Leading icon, rendered before the label. While `pending`, the spinner takes its place. */
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, pending = false, icon, disabled, children, ...props }, ref) => {
    const shared = {
      ...props,
      ...(pending ? { "aria-busy": true, "data-pending": "" } : {}),
      disabled: disabled || pending || undefined,
      className: cn(buttonVariants({ variant, size, className })),
    }
    const spinner = <Spinner size={size === "lg" ? "sm" : "xs"} />
    const leading = pending ? spinner : icon

    if (asChild) {
      // Slot finds the Slottable among its DIRECT children, so the leading slot and the
      // Slottable must be siblings here — never wrapped in a fragment.
      return leading ? (
        <Slot ref={ref} {...shared}>
          {leading}
          <Slottable>{children}</Slottable>
        </Slot>
      ) : (
        <Slot ref={ref} {...shared}>
          {children}
        </Slot>
      )
    }

    return (
      <button ref={ref} {...shared}>
        {size === "icon" ? (
          pending ? spinner : children
        ) : (
          <>
            {leading}
            {children}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = "Button"

export { Button, buttonVariants }
