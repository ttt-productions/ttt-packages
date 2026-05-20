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

interface LocalUploadGuardContextValue {
  activeUploadCount: number;
  registerUpload: (id: string) => void;
  unregisterUpload: (id: string) => void;
}

const LocalUploadGuardContext = createContext<LocalUploadGuardContextValue | undefined>(undefined);

export function LocalUploadGuardProvider({ children }: { children: ReactNode }) {
  const activeIdsRef = useRef<Set<string>>(new Set());
  const [activeUploadCount, setActiveUploadCount] = useState(0);

  const registerUpload = useCallback((id: string) => {
    if (activeIdsRef.current.has(id)) return;
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
      event.preventDefault();
      // Modern browsers may ignore the custom string and show their own
      // generic confirmation. The key behavior is that navigation is
      // blocked/warned, not the exact text.
      event.returnValue =
        'File upload in progress. Are you sure you want to leave and end the file upload?';
      return event.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeUploadCount]);

  const value = useMemo<LocalUploadGuardContextValue>(
    () => ({ activeUploadCount, registerUpload, unregisterUpload }),
    [activeUploadCount, registerUpload, unregisterUpload],
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
