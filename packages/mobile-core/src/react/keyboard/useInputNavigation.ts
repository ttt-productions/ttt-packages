import { useCallback, type RefObject } from "react";
import { getFocusableInputs } from "./focusOrder.js";

type Options = {
  /**
   * Scope inputs to a container. Pass the ref OBJECT (e.g. `formRef`), not
   * `formRef.current` — reading `.current` during render is unsound (the ref
   * is null on first render and React Compiler's `react-hooks/refs` rule
   * rejects it). A plain element is still accepted for non-React callers.
   */
  root?: RefObject<HTMLElement | null> | HTMLElement | null;
  onDone?: () => void;
};

function resolveRoot(root: Options["root"]): HTMLElement | null {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  return root.current ?? null;
}

/**
 * Attach to inputs:
 *  onKeyDown={nav.onKeyDown}
 *  onSubmitEditing={nav.onSubmitEditing} (optional)
 *
 * Also supports explicit ordering via data-input-order.
 */
export function useInputNavigation(opts?: Options) {
  const focusNext = useCallback(() => {
    // Resolved lazily, at event time — never during render.
    const scope = resolveRoot(opts?.root) ?? document;
    const inputs = getFocusableInputs(scope);
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? inputs.indexOf(active) : -1;
    const next = inputs[idx + 1];

    if (next) next.focus();
    else opts?.onDone?.();
  }, [opts]);

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
