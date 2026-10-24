'use client';

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
  fullPageNavigation?: boolean;
}

interface LocalUploadGuardContextValue {
  activeUploadCount: number;
  unsavedWorkCount: number;
  guardedWorkCount: number;
  registerUpload: (id: string) => void;
  unregisterUpload: (id: string) => void;
  registerUnsavedWork: (id: string) => void;
  unregisterUnsavedWork: (id: string) => void;
  shouldConfirmNavigation: () => boolean;
  confirmNavigation: (options?: ConfirmNavigationOptions) => boolean;
}

const LocalUploadGuardContext = createContext<LocalUploadGuardContextValue | undefined>(undefined);

export interface LocalUploadGuardProviderProps {
  beforeUnloadMessage?: string;
  navigationConfirmMessage?: string;
  unsavedWorkConfirmMessage?: string;
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
  const bypassNextUnloadRef = useRef(false);
  const clearBypass = useCallback(() => {
    bypassNextUnloadRef.current = false;
  }, []);

  const uploads = useRegistry(clearBypass);
  const unsavedWork = useRegistry(clearBypass);
  const uploadIdsRef = uploads.idsRef;
  const unsavedWorkIdsRef = unsavedWork.idsRef;
  const guardedWorkCount = uploads.count + unsavedWork.count;
  const hasGuardedWork = guardedWorkCount > 0;

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
      // Modern browsers may ignore the custom string and show their own generic confirmation.
      const message =
        beforeUnloadMessage ??
        (uploadIdsRef.current.size > 0
          ? DEFAULT_UPLOAD_BEFORE_UNLOAD_MESSAGE
          : DEFAULT_UNSAVED_WORK_BEFORE_UNLOAD_MESSAGE);
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasGuardedWork, beforeUnloadMessage, uploadIdsRef]);

  // A back/forward-cache return re-shows this page without reloading it, so an armed bypass must not
  // outlive the navigation that left.
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
    <LocalUploadGuardContext.Provider value={value}>{children}</LocalUploadGuardContext.Provider>
  );
}

export function useLocalUploadGuardContext(): LocalUploadGuardContextValue {
  const ctx = useContext(LocalUploadGuardContext);
  if (ctx === undefined) {
    throw new Error('useLocalUploadGuard must be used within LocalUploadGuardProvider');
  }
  return ctx;
}

export function useOptionalLocalUploadGuard(): LocalUploadGuardContextValue | null {
  return useContext(LocalUploadGuardContext) ?? null;
}

export function useLocalUploadGuard(): LocalUploadGuardContextValue {
  return useLocalUploadGuardContext();
}

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
