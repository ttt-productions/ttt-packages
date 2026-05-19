import { useCallback } from 'react';
import { uploadFileResumable } from '@ttt-productions/upload-core/browser';
import type { FirebaseStorage } from 'firebase/storage';
import type { UploadState } from '@ttt-productions/media-contracts';
import { useLocalUploadGuard } from './local-upload-guard-provider.js';

export interface GuardedUploadArgs {
    storage: FirebaseStorage;
    path: string;
    file: File;
    metadata: { contentType: string };
    /** Stable identifier for the in-flight upload (used to register/unregister the local-upload guard). */
    uploadId: string;
    /** Optional progress callback. Fires with preparing → uploading (with percent) → finalizing → null on completion. */
    onProgress?: (state: UploadState | null) => void;
}

/**
 * Wraps `uploadFileResumable` with the canonical local-upload guard + phase reporting.
 *
 * Every upload-capable mutation hook MUST use this helper instead of calling
 * `uploadFileResumable` directly. The helper owns:
 * - phase reporting: preparing → uploading (with percent) → finalizing
 * - beforeunload guard registration during the upload window only
 * - error safety: the guard is unregistered in a `finally` block
 *
 * The helper does NOT call `onProgress?.(null)` — callers do that from the
 * mutation's `onSuccess` and `onError` callbacks (because the upload window
 * ends when the upload completes, but the mutation may have more work after).
 */
export function useGuardedUpload() {
    const { registerUpload, unregisterUpload } = useLocalUploadGuard();

    return useCallback(async (args: GuardedUploadArgs): Promise<void> => {
        const { uploadId, onProgress, storage, path, file, metadata } = args;

        onProgress?.({ phase: 'preparing', percent: null });
        registerUpload(uploadId);
        try {
            await uploadFileResumable({
                storage,
                path,
                file,
                metadata,
                onProgress: ({ percent }) => onProgress?.({ phase: 'uploading', percent }),
            });
        } finally {
            unregisterUpload(uploadId);
        }
        onProgress?.({ phase: 'finalizing', percent: null });
    }, [registerUpload, unregisterUpload]);
}
