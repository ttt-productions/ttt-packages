"use client";

import { useEffect, useState } from "react";
import type { UploadSessionState } from "../types";
import { listUploadSessions, subscribeUploadSessionsList } from "../utils/upload-store";

export function useUploadSessions() {
  const [sessions, setSessions] = useState<UploadSessionState[]>(() => listUploadSessions());

  useEffect(() => {
    const sync = () => setSessions(listUploadSessions());
    sync();

    const unsub = subscribeUploadSessionsList(sync);
    return () => unsub();
  }, []);

  return { sessions };
}
