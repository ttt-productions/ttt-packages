"use client"

import * as React from "react"

interface OpenerFocusHandlers {
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
}

/**
 * Focus returns to the element that held it when an overlay opened, as the overlay closes. Radix's
 * modal content hands close focus to its trigger only, so an overlay opened from state — no trigger —
 * would leave focus on the page. The opener is recorded as Radix starts its open focus, before focus
 * moves inside. The caller's own `onCloseAutoFocus` runs first; when it calls `event.preventDefault()`
 * it has chosen the destination, and when the opener has left the page Radix's own return runs.
 */
export function useOpenerFocus({ onOpenAutoFocus, onCloseAutoFocus }: OpenerFocusHandlers): Required<OpenerFocusHandlers> {
  const opener = React.useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event) => {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event) => {
      onCloseAutoFocus?.(event)
      const target = opener.current
      opener.current = null
      if (event.defaultPrevented || !target?.isConnected) return
      event.preventDefault()
      target.focus()
    },
  }
}
