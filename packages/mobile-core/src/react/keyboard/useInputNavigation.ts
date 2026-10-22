import { useCallback, type RefObject } from 'react';
import { getFocusableInputs } from './focusOrder.js';
import { resolvePrefix, type CssPrefixOptions } from '../css-prefix.js';

type Options = CssPrefixOptions & {
  root?: RefObject<HTMLElement | null> | HTMLElement | null;
  onDone?: () => void;
};

function resolveRoot(root: Options['root']): HTMLElement | null {
  if (!root) return null;
  if (root instanceof HTMLElement) return root;
  return root.current ?? null;
}

export function useInputNavigation(opts?: Options) {
  const focusNext = useCallback(() => {
    // Resolved at event time: reading a ref's `.current` during render breaks React Compiler's
    // `react-hooks/refs` rule.
    const scope = resolveRoot(opts?.root) ?? document;
    const inputs = getFocusableInputs(scope, resolvePrefix(opts));
    const active = document.activeElement as HTMLElement | null;
    const idx = active ? inputs.indexOf(active) : -1;
    const next = inputs[idx + 1];

    if (next) next.focus();
    else opts?.onDone?.();
  }, [opts]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        const el = e.currentTarget as HTMLElement;
        if (el.tagName.toLowerCase() === 'textarea') return;
        e.preventDefault();
        focusNext();
      }
    },
    [focusNext],
  );

  return { focusNext, onKeyDown };
}
