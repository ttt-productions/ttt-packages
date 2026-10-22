import { useEffect } from 'react';
import { isBrowser, isIOS, isSafari } from '../../env.js';
import { resolvePrefix, type CssPrefixOptions } from '../css-prefix.js';

export function useIosSafariFixes(options?: CssPrefixOptions) {
  const prefix = resolvePrefix(options);
  useEffect(() => {
    if (!isBrowser || !isIOS || !isSafari) return;

    document.documentElement.classList.add(`${prefix}-ios-safari`);
    return () => document.documentElement.classList.remove(`${prefix}-ios-safari`);
  }, [prefix]);
}
