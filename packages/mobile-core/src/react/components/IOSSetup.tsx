"use client";

import { useIosSafariFixes } from "../ios/useIosSafariFixes.js";
import type { CssPrefixOptions } from "../css-prefix.js";

/**
 * Applies iOS-specific Safari fixes on mount. Renders nothing.
 * Pass `cssPrefix` to override the default `app-` class prefix.
 */
export function IOSSetup(props: CssPrefixOptions = {}) {
  useIosSafariFixes(props);
  return null;
}
