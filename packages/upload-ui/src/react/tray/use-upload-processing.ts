'use client';

import { useEffect, useRef } from 'react';
import {
  isPendingMediaNonTerminalStatus,
  PendingMediaStatusSchema,
} from '@ttt-productions/media-schemas';
import { useInFlightUpload, type InFlightUpload } from './in-flight-uploads-provider.js';

const STATUS = PendingMediaStatusSchema.enum;

export interface UploadProcessingState {
  status:
    'idle' | 'pending' | 'processing' | 'success' | 'failed' | 'rejected-text' | 'rejected-media';
  message: string;
  errorMessage?: string;
  isProcessing: boolean;
  isComplete: boolean;
  isFailed: boolean;
  isRejected: boolean;
}

const DEFAULT_PROCESSING_MESSAGE = 'Processing your content...';
const DEFAULT_SUCCESS_MESSAGE = 'Complete!';
const DEFAULT_FAILED_MESSAGE = 'Processing failed';
const DEFAULT_REJECTED_MESSAGE = 'Content rejected';

export interface UseUploadProcessingOptions {
  processingMessage?: string;
  successMessage?: string;
  failedMessage?: string;
  rejectedMessage?: string;
}

function buildState<TFileOrigin extends string>(
  upload: InFlightUpload<TFileOrigin> | undefined,
  opts: UseUploadProcessingOptions,
): UploadProcessingState {
  const processingMessage = opts.processingMessage ?? DEFAULT_PROCESSING_MESSAGE;
  const successMessage = opts.successMessage ?? DEFAULT_SUCCESS_MESSAGE;
  const failedMessage = opts.failedMessage ?? DEFAULT_FAILED_MESSAGE;
  const rejectedMessage = opts.rejectedMessage ?? DEFAULT_REJECTED_MESSAGE;

  if (!upload) {
    return {
      status: 'idle',
      message: '',
      isProcessing: false,
      isComplete: false,
      isFailed: false,
      isRejected: false,
    };
  }
  if (isPendingMediaNonTerminalStatus(upload.status)) {
    return {
      status: upload.status,
      message: processingMessage,
      isProcessing: true,
      isComplete: false,
      isFailed: false,
      isRejected: false,
    };
  }
  if (upload.status === STATUS.completed) {
    return {
      status: 'success',
      message: successMessage,
      isProcessing: false,
      isComplete: true,
      isFailed: false,
      isRejected: false,
    };
  }
  if (upload.status === STATUS.failed) {
    return {
      status: 'failed',
      message: failedMessage,
      errorMessage: upload.errorMessage,
      isProcessing: false,
      isComplete: false,
      isFailed: true,
      isRejected: false,
    };
  }
  if (upload.status === STATUS.rejected) {
    return {
      status: upload.rejectionType === 'text' ? 'rejected-text' : 'rejected-media',
      message: rejectedMessage,
      errorMessage: upload.errorMessage,
      isProcessing: false,
      isComplete: false,
      isFailed: false,
      isRejected: true,
    };
  }
  return {
    status: 'processing',
    message: processingMessage,
    isProcessing: true,
    isComplete: false,
    isFailed: false,
    isRejected: false,
  };
}

export function useUploadProcessing<TFileOrigin extends string = string>(
  pendingMediaId: string | null | undefined,
  onTerminal?: (state: UploadProcessingState) => void,
  options: UseUploadProcessingOptions = {},
): UploadProcessingState {
  const upload = useInFlightUpload<TFileOrigin>(pendingMediaId);
  const state = buildState(upload, options);
  const lastFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onTerminal) return;
    if (!pendingMediaId) {
      lastFiredRef.current = null;
      return;
    }
    if (state.isComplete || state.isFailed || state.isRejected) {
      const sig = `${pendingMediaId}:${state.status}`;
      if (lastFiredRef.current !== sig) {
        lastFiredRef.current = sig;
        onTerminal(state);
      }
    }
  }, [
    pendingMediaId,
    state.status,
    state.isComplete,
    state.isFailed,
    state.isRejected,
    state,
    onTerminal,
  ]);

  return state;
}
