'use client';

import * as React from 'react';

interface OpenerFocusHandlers {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

/** Radix's modal content returns close focus only to its trigger, so an overlay opened from state records its opener. */
export function useOpenerFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: OpenerFocusHandlers): Required<OpenerFocusHandlers> {
  const opener = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event) => {
      const active = document.activeElement;
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event) => {
      onCloseAutoFocus?.(event);
      const target = opener.current;
      opener.current = null;
      if (event.defaultPrevented || !target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}
