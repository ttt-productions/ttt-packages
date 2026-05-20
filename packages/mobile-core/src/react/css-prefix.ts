"use client";

/**
 * Default neutral CSS prefix for mobile-core. Consumers may override.
 * The prefix is used for CSS variables (e.g. `--<prefix>-vh`) and
 * class/attribute names (e.g. `<prefix>-ios-safari`, `data-<prefix>-input`).
 */
export const DEFAULT_MOBILE_CORE_PREFIX = "app";

export interface CssPrefixOptions {
  /** Override the default CSS prefix. Defaults to "app". */
  cssPrefix?: string;
}

export function resolvePrefix(opts?: CssPrefixOptions): string {
  return opts?.cssPrefix ?? DEFAULT_MOBILE_CORE_PREFIX;
}
