/** Chromium MediaRecorder blobs report `duration: Infinity` (or NaN) at `loadedmetadata`; seeking far past the end makes the engine compute the real duration. */
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
      el.removeEventListener('durationchange', onDurationChange);
      clearTimeout(timer);
      try {
        el.currentTime = 0;
      } catch {}
      resolve(value);
    };
    const onDurationChange = () => {
      if (Number.isFinite(el.duration)) finish(el.duration);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    el.addEventListener('durationchange', onDurationChange);
    try {
      el.currentTime = Number.MAX_SAFE_INTEGER;
    } catch {
      finish(null);
    }
  });
}
