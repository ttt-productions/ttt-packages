"use client"

import * as React from "react"
import type { DeclaredInputFormat } from "@ttt-productions/input-format-core"
import { cn } from "../../lib/utils.js"
import { formatControlAttributes } from "./format-control.js"

type NativeTextareaProps = React.ComponentPropsWithoutRef<"textarea">

/**
 * A multi-line free-text input: its declaration is required, and its length bounds come only from
 * that declaration (ENG-005), so `maxLength`, `minLength`, and `required` are not props.
 */
export type FreeTextTextareaProps = Omit<NativeTextareaProps, "maxLength" | "minLength" | "required"> & {
  inputFormat: DeclaredInputFormat
  textEntry?: never
}

/**
 * What a multi-line box that is not free text holds: identifiers (account, document, or case ids),
 * or a list of items. The box's text is split into items by the consumer, and each item is judged
 * by its own rule (the one-segment id rule, or the item's own field declaration) — so the box has
 * no input format of its own.
 */
export type NonFreeTextareaEntry = "identifier" | "list"

/** A multi-line box that is not free text: no input format; native bounds stay the caller's. */
export type NonFreeTextTextareaProps = NativeTextareaProps & {
  textEntry: NonFreeTextareaEntry
  inputFormat?: never
}

export type TextareaProps = FreeTextTextareaProps | NonFreeTextTextareaProps

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  // `textEntry` only selects the prop shape; it never reaches the DOM.
  ({ className, inputFormat, textEntry: _textEntry, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border-2 border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
        {...(inputFormat ? formatControlAttributes(inputFormat, props) : {})}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
