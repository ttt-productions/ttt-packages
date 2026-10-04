import { checkInputFormat, type InputFormatSpec } from "@ttt-productions/input-format-core"

interface CallerAttributes {
  value?: unknown
  "aria-required"?: boolean | "true" | "false"
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling"
}

/**
 * What a free-text control derives from its field declaration: the native length cap, and the
 * required/invalid state assistive technology announces. A caller's own `aria-required` or
 * `aria-invalid` wins — a form field passes the state its whole schema decided.
 *
 * The native cap counts the text as typed while the check counts it trimmed. Every value the
 * field keeps can still be typed, and surrounding whitespace is dropped by the check anyway.
 *
 * Only a controlled value is judged, and a text that is merely too short is not marked invalid
 * while it is being typed: an empty or half-typed required field is not yet an error, so "too
 * short" is left to the form's submit-time validation.
 */
export function formatControlAttributes(spec: InputFormatSpec, props: CallerAttributes) {
  const result = typeof props.value === "string" ? checkInputFormat(props.value, spec) : null
  const malformed = result !== null && !result.ok && result.issue !== "tooShort"
  return {
    maxLength: spec.max,
    "aria-required": props["aria-required"] ?? (spec.min > 0 ? true : undefined),
    "aria-invalid": props["aria-invalid"] ?? (malformed ? true : undefined),
  }
}
