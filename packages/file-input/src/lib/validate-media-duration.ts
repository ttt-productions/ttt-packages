import { resolveInfiniteDuration } from '@ttt-productions/media-viewer';

export function releaseObjectUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // A runtime without object-URL support throws here; revoking is cleanup, so nothing is lost.
  }
}

export async function validateMediaDuration(file: File, maxDurationSec: number): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio');
    el.preload = 'metadata';

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      releaseObjectUrl(el.src);
      resolve(ok);
    };

    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration)) {
        finish(el.duration <= maxDurationSec);
        return;
      }
      // Chromium MediaRecorder blobs report duration Infinity at loadedmetadata; the seek workaround
      // learns the real one.
      void resolveInfiniteDuration(el).then((duration) => {
        finish(duration === null ? true : duration <= maxDurationSec);
      });
    };

    el.onerror = () => {
      finish(true);
    };

    el.src = URL.createObjectURL(file);
  });
}
