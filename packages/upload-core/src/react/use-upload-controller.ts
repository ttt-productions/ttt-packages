"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StartUploadArgs, UploadController, UploadSessionState } from "../types";
import { startResumableUpload } from "../storage/upload";
import { getUploadSession, subscribeUploadSession } from "../utils/upload-store";

export function useUploadController() {
  const [controller, setController] = useState<UploadController | null>(null);
  const [session, setSession] = useState<UploadSessionState | null>(null);

  useEffect(() => {
    if (!controller) return;
    const id = controller.id;
    setSession(getUploadSession(id) ?? null);
    return subscribeUploadSession(id, (s) => setSession(s));
  }, [controller]);

  const start = useCallback((args: StartUploadArgs) => {
    const c = startResumableUpload({ ...args, id: args.id ?? `upl_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}` });
    setController(c);
    return c;
  }, []);

  const api = useMemo(() => {
    return {
      start,
      controller,
      session,
      pause: () => controller?.pause() ?? false,
      resume: () => controller?.resume() ?? false,
      cancel: () => controller?.cancel() ?? false,
    };
  }, [start, controller, session]);

  return api;
}
