'use client';

export const DEFAULT_MOBILE_CORE_PREFIX = 'app';

export interface CssPrefixOptions {
  cssPrefix?: string;
}

export function resolvePrefix(opts?: CssPrefixOptions): string {
  return opts?.cssPrefix ?? DEFAULT_MOBILE_CORE_PREFIX;
}
