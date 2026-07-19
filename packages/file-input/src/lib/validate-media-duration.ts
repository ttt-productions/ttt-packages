import { resolveInfiniteDuration } from "@ttt-productions/media-viewer";

export async function validateMediaDuration(file: File, maxDurationSec: number): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    el.preload = "metadata";

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try {
        URL.revokeObjectURL(el.src);
      } catch {}
      resolve(ok);
    };

    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration)) {
        finish(el.duration <= maxDurationSec);
        return;
      }
      // Chromium MediaRecorder blobs (recorded audio/video) report duration
      // Infinity at loadedmetadata — `Infinity <= max` falsely rejected every
      // recording (live 2026-07-19: a 5s clip red-texted as "over 60s").
      // Resolve the REAL duration via the shared seek workaround; if it still
      // cannot be determined, fail OPEN — recordings are hard-capped by the
      // RecordDialog timer and the backend enforces duration again at
      // processing (same rationale as the onerror fail-open below).
      void resolveInfiniteDuration(el).then((duration) => {
        finish(duration === null ? true : duration <= maxDurationSec);
      });
    };

    el.onerror = () => {
      // Fail open on client (backend can enforce again).
      finish(true);
    };

    el.src = URL.createObjectURL(file);
  });
}
