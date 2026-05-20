import { useEffect } from "react";
import { isBrowser } from "../../env.js";
import { useKeyboard } from "./useKeyboard.js";
import { resolvePrefix, type CssPrefixOptions } from "../css-prefix.js";

/**
 * When keyboard opens, ensure focused element is visible within visual viewport.
 * - iOS Safari often hides the caret behind the keyboard.
 */
export function useKeepFocusedInputVisible(opts?: CssPrefixOptions & {
  extraOffset?: number; // px
  scrollBehavior?: ScrollBehavior; // "smooth" | "auto"
}) {
  const { isOpen } = useKeyboard();
  const extraOffset = opts?.extraOffset ?? 12;
  const behavior = opts?.scrollBehavior ?? "smooth";
  const prefix = resolvePrefix(opts);

  useEffect(() => {
    if (!isBrowser) return;
    if (!isOpen) return;

    const el = document.activeElement as HTMLElement | null;
    if (!el) return;

    // only inputs-ish
    const tag = el.tagName.toLowerCase();
    const isInput =
      tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable || el.hasAttribute(`data-${prefix}-input`);
    if (!isInput) return;

    const vv = window.visualViewport;
    const vvH = vv?.height ?? window.innerHeight;
    const rect = el.getBoundingClientRect();
    const bottom = rect.bottom;
    const limit = vvH - extraOffset;

    if (bottom > limit) {
      const delta = bottom - limit;
      window.scrollBy({ top: delta, behavior });
    }
  }, [isOpen, extraOffset, behavior, prefix]);
}
