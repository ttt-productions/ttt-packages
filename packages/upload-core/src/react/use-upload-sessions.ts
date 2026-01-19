"use client";

import { useEffect, useState } from "react";
import type { UploadSessionState } from "../types";
import { listUploadSessions, subscribeUploadSession } from "../utils/upload-store";

export function useUploadSessions() {
  const [sessions, setSessions] = useState<UploadSessionState[]>(() => listUploadSessions());

  useEffect(() => {
    // naive: re-read list when any known session updates
    const current = listUploadSessions();
    setSessions(current);

    const unsubs = current.map((s) =>
      subscribeUploadSession(s.id, () => setSessions(listUploadSessions()))
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  return { sessions };
}
