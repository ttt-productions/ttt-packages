/**
 * Chromium MediaRecorder blobs (webm/opus audio, webm video) report
 * `duration: Infinity` (or NaN) at `loadedmetadata` — the webm header carries
 * no duration until the engine has scanned the stream. The standard workaround:
 * seek far past the end; the engine then computes the real duration and fires
 * `durationchange` with a finite value.
 *
 * Resolves the element's REAL finite duration in seconds, or `null` when it
 * cannot be determined within `timeoutMs` — callers decide their own fallback
 * (the file-input duration validator fails OPEN on null; the audio player
 * chrome keeps its placeholder). When the workaround seek actually ran,
 * `currentTime` is restored to 0 before resolving, so a paused just-mounted
 * preview is left visually untouched.
 */
export function resolveInfiniteDuration(
  el: HTMLMediaElement,
  timeoutMs = 3000,
): Promise<number | null> {
  if (Number.isFinite(el.duration)) return Promise.resolve(el.duration);
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      el.removeEventListener("durationchange", onDurationChange);
      clearTimeout(timer);
      try {
        el.currentTime = 0; // undo the workaround seek
      } catch {
        // detached/errored element — the resolved value still stands
      }
      resolve(value);
    };
    const onDurationChange = () => {
      if (Number.isFinite(el.duration)) finish(el.duration);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    el.addEventListener("durationchange", onDurationChange);
    try {
      el.currentTime = Number.MAX_SAFE_INTEGER;
    } catch {
      finish(null);
    }
  });
}
