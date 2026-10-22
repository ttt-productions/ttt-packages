'use client';

import { useViewportHeightVars } from '../viewport/useViewportHeightVars.js';
import { useKeepFocusedInputVisible } from '../keyboard/useKeepFocusedInputVisible.js';
import type { CssPrefixOptions } from '../css-prefix.js';

export interface ViewportHeightSetterProps extends CssPrefixOptions {
  enableKeyboardAvoidance?: boolean;
}

function KeyboardAvoidance({ cssPrefix }: CssPrefixOptions) {
  useKeepFocusedInputVisible({ cssPrefix });
  return null;
}

export function ViewportHeightSetter({
  cssPrefix,
  enableKeyboardAvoidance = true,
}: ViewportHeightSetterProps = {}) {
  useViewportHeightVars({ cssPrefix });
  if (enableKeyboardAvoidance) return <KeyboardAvoidance cssPrefix={cssPrefix} />;
  return null;
}
