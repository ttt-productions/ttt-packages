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
      // Infinity at loadedmetadata, so `Infinity <= max` would reject every
      // recording. Resolve the real duration via the shared seek workaround;
      // if it still cannot be determined, let the file through — the server
      // measures every file's length and refuses one over the limit or with
      // no length at all.
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
