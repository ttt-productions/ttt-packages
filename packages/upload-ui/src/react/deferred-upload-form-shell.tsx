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
import type { MediaOriginSpec, UploadState } from '@ttt-productions/media-schemas';

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
  /** The media-origin spec describing accept patterns, size caps, and label.
   *  Consumers pass this directly — the shell does not look it up from a registry. */
  spec: MediaOriginSpec;
  mutation: {
    mutateAsync: (vars: TVariables) => Promise<TResult>;
    isPending: boolean;
  };
  buildVariables: (
    file: File | null,
    onProgress: (s: UploadState | null) => void,
    signal: AbortSignal,
  ) => TVariables;
  onSuccess?: (result: TResult) => void;
  onError?: (err: unknown) => void;
  /**
   * Optional callback fired whenever the shell's internal selectedFile state
   * changes — on user select, on user clear, and on the post-success internal
   * reset. Forms typically use this to mirror selectedFile externally so they
   * can compute their own submit-button `disabled` flag (e.g. require-a-file
   * submit gating).
   */
  onFileChange?: (file: File | null) => void;
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
    children,
  } = props;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const fileAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleMediaChange = useCallback((payload: MediaInputChangePayload) => {
    const next = payload.error ? null : (payload.file ?? null);
    setSelectedFile(next);
    onFileChange?.(next);
  }, [onFileChange]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
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
        buildVariables(selectedFile, setUploadState, controller.signal),
      );
      setUploadState(null);
      setSelectedFile(null);
      onFileChange?.(null);
      onSuccess?.(result);
    } catch (err) {
      setUploadState(null);
      // User-initiated cancel: swallow the AbortError, reset selection, do not fire onError.
      if (err instanceof Error && err.name === 'AbortError') {
        setSelectedFile(null);
        onFileChange?.(null);
        return;
      }
      onError?.(err);
    } finally {
      abortControllerRef.current = null;
    }
  }, [mutation, selectedFile, buildVariables, onSuccess, onError, onFileChange]);

  useImperativeHandle(ref, () => ({ submit: () => { void handleSubmit(); } }), [handleSubmit]);

  return (
    <>
      {children}

      <div
        ref={fileAreaRef}
        tabIndex={-1}
        aria-live="polite"
        className="outline-none"
      >
        <MediaInput
          spec={spec}
          selectedFile={selectedFile}
          uploadState={uploadState}
          isLoading={mutation.isPending}
          disabled={mutation.isPending}
          onChange={handleMediaChange}
          onClear={handleClear}
          onCancel={handleCancel}
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
  props: DeferredUploadFormShellProps<TVariables, TResult> & { ref?: Ref<DeferredUploadFormShellHandle> },
) => React.ReactElement;
