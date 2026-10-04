"use client"

import * as React from "react"
import type { DeclaredInputFormat } from "@ttt-productions/input-format-core"
import { cn } from "../../lib/utils.js"
import { formatControlAttributes } from "./format-control.js"

/**
 * A multi-line free-text input: its declaration is required, and its length bounds come only from
 * that declaration (ENG-005), so `maxLength`, `minLength`, and `required` are not props.
 */
export type TextareaProps = Omit<React.ComponentPropsWithoutRef<"textarea">, "maxLength" | "minLength" | "required"> & {
  inputFormat: DeclaredInputFormat
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, inputFormat, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border-2 border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
        {...formatControlAttributes(inputFormat, props)}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
