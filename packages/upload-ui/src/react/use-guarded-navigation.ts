'use client';

/**
 * Wraps a navigation action so it prompts the user when an upload is in
 * progress. Returns a function that takes the consumer's actual navigation
 * call and either runs it immediately (no active uploads) or shows a confirm()
 * dialog first.
 *
 * Designed to be framework-agnostic — the consumer supplies the navigator
 * (Next.js router.push, React Router navigate, plain location.assign, etc.).
 *
 * Typical use inside a button:
 *
 *     const guardedNav = useGuardedNavigation();
 *     <Button onClick={() => guardedNav(() => router.push('/somewhere'))}>Go</Button>
 *
 * For links, use the `<GuardedLink>` render-prop wrapper.
 */

import { useCallback } from 'react';
import { useLocalUploadGuard } from './local-upload-guard-provider.js';

/**
 * Returns a callable that wraps a navigation action. Calling the returned
 * function with `performNavigation` either invokes it immediately (when no
 * active uploads) or shows a confirmation prompt; if the user confirms,
 * `performNavigation` is invoked.
 */
export function useGuardedNavigation(): (performNavigation: () => void) => void {
  const { confirmNavigation } = useLocalUploadGuard();
  return useCallback(
    (performNavigation: () => void) => {
      if (confirmNavigation()) {
        performNavigation();
      }
    },
    [confirmNavigation],
  );
}
