'use client';

import { useCallback } from 'react';
import {
  useLocalUploadGuard,
  type ConfirmNavigationOptions,
} from './local-upload-guard-provider.js';

export function useGuardedNavigation(): (
  performNavigation: () => void,
  options?: ConfirmNavigationOptions,
) => void {
  const { confirmNavigation } = useLocalUploadGuard();
  return useCallback(
    (performNavigation: () => void, options?: ConfirmNavigationOptions) => {
      if (confirmNavigation(options)) {
        performNavigation();
      }
    },
    [confirmNavigation],
  );
}
