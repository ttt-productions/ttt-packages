'use client';

import React, {
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type ReactNode,
  type Ref,
} from 'react';
import { MediaInput } from '@ttt-productions/file-input/react';
import type { MediaInputChangePayload } from '@ttt-productions/file-input';
import type {
  ClientMediaClaim,
  MediaOriginSpec,
  UploadState,
} from '@ttt-productions/media-schemas';

export interface DeferredUploadFormShellHandle {
  submit: () => void;
}

export interface DeferredUploadFormShellProps<
  TVariables extends {
    onProgress?: (s: UploadState | null) => void;
    signal?: AbortSignal;
  },
  TResult = unknown,
> {
  spec: MediaOriginSpec;
  mutation: {
    mutateAsync: (vars: TVariables) => Promise<TResult>;
    isPending: boolean;
  };
  buildVariables: (
    file: File | null,
    onProgress: (s: UploadState | null) => void,
    signal: AbortSignal,
    claim?: ClientMediaClaim,
  ) => TVariables;
  onSuccess?: (result: TResult) => void;
  onError?: (err: unknown) => void;
  onFileChange?: (file: File | null) => void;
  onBeforeSelect?: () => boolean | Promise<boolean>;
  children?: ReactNode;
}

function DeferredUploadFormShellInner<
  TVariables extends {
    onProgress?: (s: UploadState | null) => void;
    signal?: AbortSignal;
  },
  TResult = unknown,
>(
  props: DeferredUploadFormShellProps<TVariables, TResult>,
  ref: Ref<DeferredUploadFormShellHandle>,
) {
  const {
    spec,
    mutation,
    buildVariables,
    onSuccess,
    onError,
    onFileChange,
    onBeforeSelect,
    children,
  } = props;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<ClientMediaClaim | undefined>(undefined);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const fileAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleMediaChange = useCallback(
    (payload: MediaInputChangePayload) => {
      const next = payload.error ? null : (payload.file ?? null);
      setSelectedFile(next);
      setSelectedClaim(next ? payload.claim : undefined);
      onFileChange?.(next);
    },
    [onFileChange],
  );

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setSelectedClaim(undefined);
    onFileChange?.(null);
  }, [onFileChange]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (mutation.isPending) return;
    if (selectedFile) {
      fileAreaRef.current?.focus();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const result = await mutation.mutateAsync(
        buildVariables(selectedFile, setUploadState, controller.signal, selectedClaim),
      );
      setUploadState(null);
      setSelectedFile(null);
      setSelectedClaim(undefined);
      onFileChange?.(null);
      onSuccess?.(result);
    } catch (err) {
      setUploadState(null);
      if (err instanceof Error && err.name === 'AbortError') {
        setSelectedFile(null);
        setSelectedClaim(undefined);
        onFileChange?.(null);
        return;
      }
      onError?.(err);
    } finally {
      abortControllerRef.current = null;
    }
  }, [mutation, selectedFile, selectedClaim, buildVariables, onSuccess, onError, onFileChange]);

  useImperativeHandle(
    ref,
    () => ({
      submit: () => {
        void handleSubmit();
      },
    }),
    [handleSubmit],
  );

  return (
    <>
      {children}

      <div ref={fileAreaRef} tabIndex={-1} aria-live="polite" className="outline-none">
        <MediaInput
          spec={spec}
          selectedFile={selectedFile}
          uploadState={uploadState}
          isLoading={mutation.isPending}
          disabled={mutation.isPending}
          onChange={handleMediaChange}
          onClear={handleClear}
          onCancel={handleCancel}
          onBeforeSelect={onBeforeSelect}
        />
      </div>
    </>
  );
}

export const DeferredUploadFormShell = forwardRef(DeferredUploadFormShellInner) as <
  TVariables extends {
    onProgress?: (s: UploadState | null) => void;
    signal?: AbortSignal;
  },
  TResult = unknown,
>(
  props: DeferredUploadFormShellProps<TVariables, TResult> & {
    ref?: Ref<DeferredUploadFormShellHandle>;
  },
) => React.ReactElement;
