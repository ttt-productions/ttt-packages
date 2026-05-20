"use client";

import { useViewportHeightVars } from "../viewport/useViewportHeightVars.js";
import { useKeepFocusedInputVisible } from "../keyboard/useKeepFocusedInputVisible.js";
import type { CssPrefixOptions } from "../css-prefix.js";

export interface ViewportHeightSetterProps extends CssPrefixOptions {
  /**
   * When true (default), also enables global keyboard-aware input scrolling on mobile.
   */
  enableKeyboardAvoidance?: boolean;
}

function KeyboardAvoidance({ cssPrefix }: CssPrefixOptions) {
  useKeepFocusedInputVisible({ cssPrefix });
  return null;
}

/**
 * Sets the `--<prefix>-vh` and `--<prefix>-dvh` CSS custom properties.
 * Defaults to `--app-vh` / `--app-dvh`.
 */
export function ViewportHeightSetter({
  cssPrefix,
  enableKeyboardAvoidance = true,
}: ViewportHeightSetterProps = {}) {
  useViewportHeightVars({ cssPrefix });
  if (enableKeyboardAvoidance) return <KeyboardAvoidance cssPrefix={cssPrefix} />;
  return null;
}
