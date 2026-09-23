'use client';

/**
 * Local upload navigation guard provider.
 *
 * Tracks the count of in-progress LOCAL byte uploads (file → Firebase
 * Storage). While the count is > 0, installs a `beforeunload` listener
 * to warn the user before they close the tab or reload mid-upload.
 *
 * Scope:
 *  - Covers phases `preparing` and `uploading` only.
 *  - Does NOT cover `finalizing` — at that point bytes are already in
 *    Storage and the only remaining work is the `startUpload` callable.
 *  - Does NOT cover backend `pendingMedia` status (`pending` /
 *    `processing`). Those run server-side and are safe to leave.
 *
 * Consumers register with a stable id (typically the local upload
 * session id or `pendingMedia` doc id once known) on entering
 * `preparing`/`uploading`, and unregister on transition to
 * `finalizing`/success/error/cancel/unmount.
 *
 * Public hook: `useLocalUploadGuard()` returns
 * `{ activeUploadCount, registerUpload, unregisterUpload }`. Throws if
 * used outside a `LocalUploadGuardProvider`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface ConfirmNavigationOptions {
  /**
   * The caller leaves through a FULL-PAGE navigation (`location.assign` /
   * `location.replace`) once this returns true. The provider then lets that
   * navigation's next `beforeunload` pass without the browser's own
   * "Leave site?" prompt, because the user has just answered this one. Soft
   * (in-app router) navigations never pass it: they fire no `beforeunload`.
   */
  fullPageNavigation?: boolean;
}

interface LocalUploadGuardContextValue {
  activeUploadCount: number;
  registerUpload: (id: string) => void;
  unregisterUpload: (id: string) => void;
  /** Returns true iff at least one upload is currently registered. Pure read. */
  shouldConfirmNavigation: () => boolean;
  /**
   * Shows a confirm() dialog with the configured message and returns the user's
   * choice. Safe to call when no upload is active — returns true without prompting.
   *
   * With `{ fullPageNavigation: true }` and a result of true (confirmed, or no
   * upload active), arms a ONE-SHOT bypass: the next `beforeunload` is not
   * prevented, so a confirmed full-page navigation does not prompt twice. A
   * declined confirm never arms it; the bypass is cleared when it is consumed, when
   * a new upload registers, and on `pageshow` (a back/forward-cache return).
   */
  confirmNavigation: (options?: ConfirmNavigationOptions) => boolean;
}

const LocalUploadGuardContext = createContext<LocalUploadGuardContextValue | undefined>(undefined);

export interface LocalUploadGuardProviderProps {
  /**
   * Message shown by the browser when the user attempts to close the tab or
   * reload during an active upload. Modern browsers may ignore the custom
   * string and show a generic dialog.
   */
  beforeUnloadMessage?: string;
  /**
   * Message shown by `confirmNavigation()` when an upload is in progress and
   * the user attempts to navigate away within the app. Defaults to a
   * reasonable English string.
   */
  navigationConfirmMessage?: string;
  children: ReactNode;
}

const DEFAULT_BEFORE_UNLOAD_MESSAGE =
  'File upload in progress. Are you sure you want to leave and end the file upload?';
const DEFAULT_NAVIGATION_CONFIRM_MESSAGE =
  'An upload is currently in progress. If you leave this page, the upload will be canceled. Continue?';

export function LocalUploadGuardProvider(props: LocalUploadGuardProviderProps) {
  const {
    children,
    beforeUnloadMessage = DEFAULT_BEFORE_UNLOAD_MESSAGE,
    navigationConfirmMessage = DEFAULT_NAVIGATION_CONFIRM_MESSAGE,
  } = props;
  const activeIdsRef = useRef<Set<string>>(new Set());
  const [activeUploadCount, setActiveUploadCount] = useState(0);
  // One-shot: the user already confirmed the full-page navigation now unloading.
  const bypassNextUnloadRef = useRef(false);

  const registerUpload = useCallback((id: string) => {
    if (activeIdsRef.current.has(id)) return;
    // Work that starts after a confirmation was not covered by it.
    bypassNextUnloadRef.current = false;
    activeIdsRef.current.add(id);
    setActiveUploadCount(activeIdsRef.current.size);
  }, []);

  const unregisterUpload = useCallback((id: string) => {
    if (!activeIdsRef.current.has(id)) return;
    activeIdsRef.current.delete(id);
    setActiveUploadCount(activeIdsRef.current.size);
  }, []);

  useEffect(() => {
    if (activeUploadCount <= 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassNextUnloadRef.current) {
        bypassNextUnloadRef.current = false;
        return;
      }
      event.preventDefault();
      // Modern browsers may ignore the custom string and show their own
      // generic confirmation. The key behavior is that navigation is
      // blocked/warned, not the exact text.
      event.returnValue = beforeUnloadMessage;
      return event.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeUploadCount, beforeUnloadMessage]);

  // A back/forward-cache return re-shows this page without reloading it: an
  // armed bypass from the navigation that left must never outlive that navigation.
  useEffect(() => {
    const clearBypass = () => {
      bypassNextUnloadRef.current = false;
    };
    window.addEventListener('pageshow', clearBypass);
    return () => {
      window.removeEventListener('pageshow', clearBypass);
    };
  }, []);

  const shouldConfirmNavigation = useCallback(
    () => activeIdsRef.current.size > 0,
    [],
  );

  const confirmNavigation = useCallback(
    (options?: ConfirmNavigationOptions): boolean => {
      // SSR / non-browser safety: if `window` isn't available, default to allow.
      if (typeof window === 'undefined') return true;
      const proceed =
        activeIdsRef.current.size === 0 || window.confirm(navigationConfirmMessage);
      if (proceed && options?.fullPageNavigation) bypassNextUnloadRef.current = true;
      return proceed;
    },
    [navigationConfirmMessage],
  );

  const value = useMemo<LocalUploadGuardContextValue>(
    () => ({
      activeUploadCount,
      registerUpload,
      unregisterUpload,
      shouldConfirmNavigation,
      confirmNavigation,
    }),
    [activeUploadCount, registerUpload, unregisterUpload, shouldConfirmNavigation, confirmNavigation],
  );

  return (
    <LocalUploadGuardContext.Provider value={value}>
      {children}
    </LocalUploadGuardContext.Provider>
  );
}

/**
 * Low-level accessor for the local-upload guard context. Throws if used
 * outside a `LocalUploadGuardProvider`. Most consumers should use
 * `useLocalUploadGuard` (the public re-export below) instead.
 */
export function useLocalUploadGuardContext(): LocalUploadGuardContextValue {
  const ctx = useContext(LocalUploadGuardContext);
  if (ctx === undefined) {
    throw new Error(
      'useLocalUploadGuard must be used within LocalUploadGuardProvider',
    );
  }
  return ctx;
}

/**
 * Optional accessor: returns the guard context, or `null` when rendered
 * outside a `LocalUploadGuardProvider`. For package components (e.g. the
 * chat composer registering an in-flight send) that must degrade gracefully
 * in consumers that don't mount the provider, instead of throwing.
 */
export function useOptionalLocalUploadGuard(): LocalUploadGuardContextValue | null {
  return useContext(LocalUploadGuardContext) ?? null;
}

/**
 * Public hook for the local upload navigation guard.
 *
 * Returns `{ activeUploadCount, registerUpload, unregisterUpload }`.
 *
 * Typical usage in an upload flow:
 *
 *     const { registerUpload, unregisterUpload } = useLocalUploadGuard();
 *     useEffect(() => {
 *       if (phase === 'preparing' || phase === 'uploading') {
 *         registerUpload(uploadId);
 *         return () => unregisterUpload(uploadId);
 *       }
 *     }, [phase, uploadId, registerUpload, unregisterUpload]);
 */
export function useLocalUploadGuard(): LocalUploadGuardContextValue {
  return useLocalUploadGuardContext();
}
