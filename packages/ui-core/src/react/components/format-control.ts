import { checkInputFormat, type InputFormatSpec } from "@ttt-productions/input-format-core"

interface CallerAttributes {
  value?: unknown
  readOnly?: boolean
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
 *
 * A read-only control shows a stored value nobody can edit there, so it is never judged: it
 * announces neither required nor invalid (a stored value may legitimately fail the typed format).
 */
export function formatControlAttributes(spec: InputFormatSpec, props: CallerAttributes) {
  if (props.readOnly) {
    return {
      maxLength: spec.max,
      "aria-required": props["aria-required"],
      "aria-invalid": props["aria-invalid"],
    }
  }
  const result = typeof props.value === "string" ? checkInputFormat(props.value, spec) : null
  const malformed = result !== null && !result.ok && result.issue !== "tooShort"
  return {
    maxLength: spec.max,
    "aria-required": props["aria-required"] ?? (spec.min > 0 ? true : undefined),
    "aria-invalid": props["aria-invalid"] ?? (malformed ? true : undefined),
  }
}

/**
 * Shows a free-text box's kept value once focus leaves it, delivered through the parent's own
 * `onChange`: the native value setter plus an input event is what React hears as a typed change, so a
 * controlled box and a react-hook-form `register` box both receive it. Nothing changes while typing.
 * A read-only or disabled box shows a stored value nobody edits there, so it is never tidied.
 */
export function tidyOnBlur(box: HTMLInputElement | HTMLTextAreaElement, spec: InputFormatSpec) {
  if (box.readOnly || box.disabled) return
  const kept = checkInputFormat(box.value, spec).value
  if (kept === box.value) return
  const prototype = box instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(box, kept)
  box.dispatchEvent(new Event("input", { bubbles: true }))
}
