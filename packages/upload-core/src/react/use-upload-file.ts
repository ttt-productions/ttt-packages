"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UploadFileResumableResult } from "../types.js";
import type { UploadFileResumableArgs } from "../browser/types.js";
import { uploadFileResumable } from "../storage/upload.js";

export function useUploadFile() {
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const upload = useCallback(
    async (args: Omit<UploadFileResumableArgs, "onProgress">): Promise<UploadFileResumableResult> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        const res = await uploadFileResumable({
          ...args,
          onProgress: ({ percent }: { percent: number }) => {
            if (!mountedRef.current) return;
            setProgress(percent);
          },
        });

        if (!mountedRef.current) return res;

        setProgress(100);
        setIsUploading(false);
        return res;
      } catch (e) {
        if (mountedRef.current) {
          setError(e);
          setIsUploading(false);
        }
        throw e;
      }
    },
    []
  );

  return { upload, progress, isUploading, error };
}
