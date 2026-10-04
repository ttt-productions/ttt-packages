"use client"

import * as React from "react"
import type { DeclaredInputFormat } from "@ttt-productions/input-format-core"
import { cn } from "../../lib/utils.js"
import { formatControlAttributes } from "./format-control.js"

/**
 * The input types whose value the browser itself formats or picks — not free text — so they take no
 * input format. A free-text input (`type` omitted or `"text"`) takes one.
 */
export type BuiltInFormatInputType =
  | "password"
  | "email"
  | "number"
  | "tel"
  | "url"
  | "search"
  | "file"
  | "color"
  | "date"
  | "datetime-local"
  | "month"
  | "week"
  | "time"
  | "range"
  | "checkbox"
  | "radio"
  | "hidden"
  | "button"
  | "submit"
  | "reset"
  | "image"

type NativeInputProps = React.ComponentPropsWithoutRef<"input">

/**
 * A free-text input: its declaration is required, and its bounds and its required state come only
 * from that declaration (ENG-005), so `maxLength`, `minLength`, `pattern`, and `required` are not
 * props.
 */
export type FreeTextInputProps = Omit<
  NativeInputProps,
  "type" | "maxLength" | "minLength" | "pattern" | "required"
> & {
  type?: "text"
  inputFormat: DeclaredInputFormat
  textEntry?: never
}

/**
 * What a text box that is not free text holds: digits typed as text (a date-of-birth part, a share
 * count, a one-time code) or an identifier (an account, document, or case id). Neither takes an
 * input format; each keeps its own native `maxLength`, `pattern`, and `inputMode`, and its value is
 * checked by its own rule (a whole-input number parse, the one-segment id rule).
 */
export type NonFreeTextEntry = "numeric" | "identifier"

/** A text box that is not free text: no input format. */
export type NonFreeTextInputProps = Omit<NativeInputProps, "type"> & {
  type?: "text"
  textEntry: NonFreeTextEntry
  inputFormat?: never
}

/** An input whose value the browser formats: no input format. */
export type BuiltInFormatInputProps = Omit<NativeInputProps, "type"> & {
  type: BuiltInFormatInputType
  inputFormat?: never
  textEntry?: never
}

export type InputProps = FreeTextInputProps | NonFreeTextInputProps | BuiltInFormatInputProps

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  // `textEntry` only selects the prop shape; it never reaches the DOM.
  ({ className, type, inputFormat, textEntry: _textEntry, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border-2 border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
        {...(inputFormat ? formatControlAttributes(inputFormat, props) : {})}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
