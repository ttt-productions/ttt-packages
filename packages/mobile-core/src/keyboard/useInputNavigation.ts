import { useCallback } from "react";
import { getFocusableInputs } from "./focusOrder";

type Options = {
  root?: HTMLElement | null; // scope inputs
  onDone?: () => void;
};

/**
 * Attach to inputs:
 *  onKeyDown={nav.onKeyDown}
 *  onSubmitEditing={nav.onSubmitEditing} (optional)
 *
 * Also supports explicit ordering via data-input-order.
 */
export function useInputNavigation(opts?: Options) {
  const root = opts?.root ?? null;

  const focusNext = useCallback(() => {
    const scope = root ?? document;
    const inputs = getFocusableInputs(scope as any);
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? inputs.indexOf(active) : -1;
    const next = inputs[idx + 1];

    if (next) next.focus();
    else opts?.onDone?.();
  }, [root, opts]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        // allow textarea newlines
        const el = e.currentTarget as HTMLElement;
        if (el.tagName.toLowerCase() === "textarea") return;
        e.preventDefault();
        focusNext();
      }
    },
    [focusNext]
  );

  return { focusNext, onKeyDown };
}
