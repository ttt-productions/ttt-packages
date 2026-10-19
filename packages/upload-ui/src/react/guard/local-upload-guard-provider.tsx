'use client';

/**
 * The navigation and leave guard: warns before the user leaves while work that leaving would lose
 * is registered — a LOCAL byte upload in flight, or an editor's unsaved input.
 *
 * Uploads: phases `preparing` and `uploading` only. `finalizing` and backend `pendingMedia`
 * processing are safe to leave (the bytes are already in Storage), so they are not registered.
 * Unsaved work: an editor registers while it holds input its user has not saved, and unregisters
 * when the input is saved, discarded, or the editor unmounts.
 *
 * While anything is registered the provider installs ONE `beforeunload` listener (tab close,
 * reload, full-page navigation), and `confirmNavigation()` asks before an in-app navigation. It is
 * the one leave guard: an editor never installs its own `beforeunload` handler (FRONTEND-207).
 *
 * Consumers register with a stable id per piece of work; registering a registered id, or
 * unregistering an absent one, is a no-op. Uploads and unsaved work are counted separately, so the
 * same id may be both.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
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
  /** Registered local uploads. */
  activeUploadCount: number;
  /** Registered pieces of unsaved work. */
  unsavedWorkCount: number;
  /** Everything the guard warns about: uploads plus unsaved work. Zero means leaving asks nothing. */
  guardedWorkCount: number;
  registerUpload: (id: string) => void;
  unregisterUpload: (id: string) => void;
  registerUnsavedWork: (id: string) => void;
  unregisterUnsavedWork: (id: string) => void;
  /** Returns true iff an upload or unsaved work is currently registered. Pure read. */
  shouldConfirmNavigation: () => boolean;
  /**
   * Shows a confirm() dialog with the message for what is registered and returns the user's
   * choice. Safe to call when nothing is registered — returns true without prompting.
   *
   * With `{ fullPageNavigation: true }` and a result of true (confirmed, or nothing registered),
   * arms a ONE-SHOT bypass: the next `beforeunload` is not prevented, so a confirmed full-page
   * navigation does not prompt twice. A declined confirm never arms it; the bypass is cleared when
   * it is consumed, when new work (an upload or unsaved work) registers, and on `pageshow` (a
   * back/forward-cache return).
   */
  confirmNavigation: (options?: ConfirmNavigationOptions) => boolean;
}

const LocalUploadGuardContext = createContext<LocalUploadGuardContextValue | undefined>(undefined);

export interface LocalUploadGuardProviderProps {
  /**
   * Message the browser is given when the user closes the tab, reloads, or leaves the page while
   * work is registered. Modern browsers show their own generic dialog and ignore it; when omitted,
   * the default for what is registered is used.
   */
  beforeUnloadMessage?: string;
  /** `confirmNavigation()`'s message while an upload is in progress (and no unsaved work). */
  navigationConfirmMessage?: string;
  /** `confirmNavigation()`'s message while unsaved work is registered (and no upload). */
  unsavedWorkConfirmMessage?: string;
  /** `confirmNavigation()`'s message while both an upload and unsaved work are registered. */
  uploadAndUnsavedWorkConfirmMessage?: string;
  children: ReactNode;
}

const DEFAULT_NAVIGATION_CONFIRM_MESSAGE =
  'An upload is currently in progress. If you leave this page, the upload will be canceled. Continue?';
const DEFAULT_UNSAVED_WORK_CONFIRM_MESSAGE =
  'You have unsaved changes. If you leave this page, they will be lost. Continue?';
const DEFAULT_UPLOAD_AND_UNSAVED_WORK_CONFIRM_MESSAGE =
  'An upload is in progress and you have unsaved changes. If you leave this page, the upload will be canceled and your changes will be lost. Continue?';
const DEFAULT_UPLOAD_BEFORE_UNLOAD_MESSAGE =
  'File upload in progress. Are you sure you want to leave and end the file upload?';
const DEFAULT_UNSAVED_WORK_BEFORE_UNLOAD_MESSAGE =
  'You have unsaved changes. Are you sure you want to leave and lose them?';

function useRegistry(onRegister: () => void) {
  const idsRef = useRef<Set<string>>(new Set());
  const [count, setCount] = useState(0);

  const register = useCallback(
    (id: string) => {
      if (idsRef.current.has(id)) return;
      onRegister();
      idsRef.current.add(id);
      setCount(idsRef.current.size);
    },
    [onRegister],
  );

  const unregister = useCallback((id: string) => {
    if (!idsRef.current.has(id)) return;
    idsRef.current.delete(id);
    setCount(idsRef.current.size);
  }, []);

  return { idsRef, count, register, unregister };
}

export function LocalUploadGuardProvider(props: LocalUploadGuardProviderProps) {
  const {
    children,
    beforeUnloadMessage,
    navigationConfirmMessage = DEFAULT_NAVIGATION_CONFIRM_MESSAGE,
    unsavedWorkConfirmMessage = DEFAULT_UNSAVED_WORK_CONFIRM_MESSAGE,
    uploadAndUnsavedWorkConfirmMessage = DEFAULT_UPLOAD_AND_UNSAVED_WORK_CONFIRM_MESSAGE,
  } = props;
  // One-shot: the user already confirmed the full-page navigation now unloading.
  const bypassNextUnloadRef = useRef(false);
  // Also run when work registers: work that starts after a confirmation was not covered by it.
  const clearBypass = useCallback(() => {
    bypassNextUnloadRef.current = false;
  }, []);

  const uploads = useRegistry(clearBypass);
  const unsavedWork = useRegistry(clearBypass);
  const uploadIdsRef = uploads.idsRef;
  const unsavedWorkIdsRef = unsavedWork.idsRef;
  const guardedWorkCount = uploads.count + unsavedWork.count;
  const hasGuardedWork = guardedWorkCount > 0;

  // Read at the moment of asking, so a message always matches what is registered right then.
  const confirmMessage = useCallback((): string => {
    const uploading = uploadIdsRef.current.size > 0;
    const unsaved = unsavedWorkIdsRef.current.size > 0;
    if (uploading && unsaved) return uploadAndUnsavedWorkConfirmMessage;
    return uploading ? navigationConfirmMessage : unsavedWorkConfirmMessage;
  }, [
    uploadIdsRef,
    unsavedWorkIdsRef,
    navigationConfirmMessage,
    unsavedWorkConfirmMessage,
    uploadAndUnsavedWorkConfirmMessage,
  ]);

  useEffect(() => {
    if (!hasGuardedWork) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassNextUnloadRef.current) {
        bypassNextUnloadRef.current = false;
        return;
      }
      event.preventDefault();
      // Modern browsers may ignore the custom string and show their own generic confirmation;
      // what matters is that leaving is warned, not the exact text.
      event.returnValue =
        beforeUnloadMessage ??
        (uploadIdsRef.current.size > 0
          ? DEFAULT_UPLOAD_BEFORE_UNLOAD_MESSAGE
          : DEFAULT_UNSAVED_WORK_BEFORE_UNLOAD_MESSAGE);
      return event.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasGuardedWork, beforeUnloadMessage, uploadIdsRef]);

  // A back/forward-cache return re-shows this page without reloading it: an
  // armed bypass from the navigation that left must never outlive that navigation.
  useEffect(() => {
    window.addEventListener('pageshow', clearBypass);
    return () => {
      window.removeEventListener('pageshow', clearBypass);
    };
  }, [clearBypass]);

  const shouldConfirmNavigation = useCallback(
    () => uploadIdsRef.current.size > 0 || unsavedWorkIdsRef.current.size > 0,
    [uploadIdsRef, unsavedWorkIdsRef],
  );

  const confirmNavigation = useCallback(
    (options?: ConfirmNavigationOptions): boolean => {
      // SSR / non-browser safety: if `window` isn't available, default to allow.
      if (typeof window === 'undefined') return true;
      const proceed = !shouldConfirmNavigation() || window.confirm(confirmMessage());
      if (proceed && options?.fullPageNavigation) bypassNextUnloadRef.current = true;
      return proceed;
    },
    [shouldConfirmNavigation, confirmMessage],
  );

  const value = useMemo<LocalUploadGuardContextValue>(
    () => ({
      activeUploadCount: uploads.count,
      unsavedWorkCount: unsavedWork.count,
      guardedWorkCount,
      registerUpload: uploads.register,
      unregisterUpload: uploads.unregister,
      registerUnsavedWork: unsavedWork.register,
      unregisterUnsavedWork: unsavedWork.unregister,
      shouldConfirmNavigation,
      confirmNavigation,
    }),
    [
      uploads.count,
      uploads.register,
      uploads.unregister,
      unsavedWork.count,
      unsavedWork.register,
      unsavedWork.unregister,
      guardedWorkCount,
      shouldConfirmNavigation,
      confirmNavigation,
    ],
  );

  return (
    <LocalUploadGuardContext.Provider value={value}>
      {children}
    </LocalUploadGuardContext.Provider>
  );
}

/**
 * Low-level accessor for the guard context. Throws if used outside a
 * `LocalUploadGuardProvider`. Most consumers should use `useLocalUploadGuard`
 * (the public re-export below) instead.
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
 * Public hook for the navigation and leave guard.
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
 *
 * An editor holding input uses `useUnsavedWorkGuard(hasUnsavedWork)` instead.
 */
export function useLocalUploadGuard(): LocalUploadGuardContextValue {
  return useLocalUploadGuardContext();
}

/**
 * Registers the calling editor's unsaved input with the leave guard while `hasUnsavedWork` is
 * true, and unregisters it when that turns false or the editor unmounts. While registered, closing
 * the tab, reloading, a full-page navigation, and every guarded in-app navigation ask first.
 * Throws outside a `LocalUploadGuardProvider`.
 *
 * Returns `release`, which unregisters at once: an editor that saves and then navigates in the
 * same handler calls it after the save, because its dirty flag clears only on the next render.
 */
export function useUnsavedWorkGuard(hasUnsavedWork: boolean): { release: () => void } {
  const { registerUnsavedWork, unregisterUnsavedWork } = useLocalUploadGuardContext();
  const id = useId();
  useEffect(() => {
    if (!hasUnsavedWork) return;
    registerUnsavedWork(id);
    return () => unregisterUnsavedWork(id);
  }, [hasUnsavedWork, id, registerUnsavedWork, unregisterUnsavedWork]);
  const release = useCallback(() => unregisterUnsavedWork(id), [id, unregisterUnsavedWork]);
  return useMemo(() => ({ release }), [release]);
}
