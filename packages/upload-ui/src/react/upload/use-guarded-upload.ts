import { useCallback } from 'react';
import { uploadFileResumable } from '@ttt-productions/upload-core/browser';
import type { FirebaseStorage } from 'firebase/storage';
import type { UploadState } from '@ttt-productions/media-schemas';
import { useLocalUploadGuard } from '../guard/local-upload-guard-provider.js';

export interface GuardedUploadArgs {
  storage: FirebaseStorage;
  path: string;
  file: File;
  metadata: { contentType: string };
  uploadId: string;
  onProgress?: (state: UploadState | null) => void;
  signal?: AbortSignal;
  allowNeutralContentType?: boolean;
}

export function useGuardedUpload() {
  const { registerUpload, unregisterUpload } = useLocalUploadGuard();

  return useCallback(
    async (args: GuardedUploadArgs): Promise<void> => {
      const {
        uploadId,
        onProgress,
        storage,
        path,
        file,
        metadata,
        signal,
        allowNeutralContentType,
      } = args;

      onProgress?.({ phase: 'preparing', percent: null });
      registerUpload(uploadId);
      try {
        await uploadFileResumable({
          storage,
          path,
          file,
          metadata,
          signal,
          ...(allowNeutralContentType === true ? { allowNeutralContentType: true } : {}),
          onProgress: ({ percent }) => onProgress?.({ phase: 'uploading', percent }),
        });
      } finally {
        unregisterUpload(uploadId);
      }
      onProgress?.({ phase: 'finalizing', percent: null });
    },
    [registerUpload, unregisterUpload],
  );
}
