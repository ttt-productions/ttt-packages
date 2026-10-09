import type * as React from "react"

/** Cancels an event and stops it in the capture phase, before any handler on the control runs. */
export function blockEvent(event: React.SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

const ACTIVATION_KEYS = new Set([" ", "Enter", "ArrowUp", "ArrowDown"])

/**
 * Stops the keys that act on a pending control — Space, Enter, ArrowUp, ArrowDown (which open a
 * trigger) and a single printable character (a trigger's typeahead) — and lets every other key
 * through, so Tab, Escape, function keys, and shortcuts behave as usual.
 */
export function blockActivationKey(event: React.KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (ACTIVATION_KEYS.has(event.key) || event.key.length === 1) blockEvent(event)
}
