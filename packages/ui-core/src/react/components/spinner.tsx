"use client"

import { Loader2 } from "lucide-react"

import { cn } from "../../lib/utils.js"

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl"

export interface SpinnerProps {
  /** Maps onto the theme-core `spinner-*` classes. Defaults to `xs` (the in-control size). */
  size?: SpinnerSize
  /**
   * Screen-reader text. When set, the spinner becomes a `status` live region that
   * announces it. Omit it for a spinner inside a control that already carries its
   * own busy state (`aria-busy`) — the control speaks for it.
   */
  label?: string
  className?: string
}

const SIZE_CLASS: Record<SpinnerSize, string> = {
  xs: "spinner-xs",
  sm: "spinner-sm",
  md: "spinner-md",
  lg: "spinner-lg",
  xl: "spinner-xl",
}

/**
 * The ONE loading spinner. Every in-progress indicator renders through this
 * component (or through a control's `pending` prop, which renders it), so the
 * spinner's look, size scale, and color rule have one change point. The
 * theme-core `spinner-*` classes own size, animation, and color — including the
 * `button .spinner-*` rule that makes an in-button spinner inherit the button's
 * text color so it is never primary-on-primary.
 */
function Spinner({ size = "xs", label, className }: SpinnerProps) {
  if (!label) {
    return <Loader2 className={cn(SIZE_CLASS[size], className)} aria-hidden="true" />
  }
  return (
    <span role="status" className={cn("inline-flex items-center justify-center", className)}>
      <Loader2 className={SIZE_CLASS[size]} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export { Spinner }
