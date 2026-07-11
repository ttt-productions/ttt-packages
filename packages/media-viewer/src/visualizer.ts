// Shared audio-visualizer render engine — the ONE waveform implementation for
// both live-mic recording (file-input's record dialog) and playback (the
// custom AudioPlayer chrome in this package). Consumers own the Web Audio
// graph (mic stream source vs media-element source) and hand this engine an
// AnalyserNode + canvas; the engine owns only the draw loop.
//
// No React, no top-level browser API access — server-safe to import; browser
// APIs are touched only when `startWaveformLoop` is called.

/** How the analyser data is drawn. `line` = oscilloscope (time domain, the
 *  recording dialog's original visual); `bars` = frequency bars (EQ dance). */
export type AudioVisualizerMode = "line" | "bars";

export type StartWaveformLoopOptions = {
  analyser: AnalyserNode;
  /** Resolved every frame so the canvas may mount/unmount freely. */
  getCanvas: () => HTMLCanvasElement | null;
  /** Fixed mode, or a getter resolved every frame (live mode toggling). */
  mode?: AudioVisualizerMode | (() => AudioVisualizerMode);
};

/**
 * Start the requestAnimationFrame draw loop. Returns a `stop()` that cancels
 * the loop; stopping is idempotent. The loop also self-terminates when the
 * canvas 2D context is unavailable. All strokes/fills use `currentColor`, so
 * the canvas inherits its color from CSS.
 */
export function startWaveformLoop(options: StartWaveformLoopOptions): () => void {
  const { analyser, getCanvas } = options;
  const resolveMode: () => AudioVisualizerMode =
    typeof options.mode === "function" ? options.mode : () => (options.mode as AudioVisualizerMode) ?? "line";

  const timeData = new Uint8Array(analyser.frequencyBinCount);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  let rafId: number | null = null;
  let stopped = false;

  const draw = () => {
    if (stopped) return;
    const canvas = getCanvas();
    if (!canvas) {
      // Canvas not mounted this frame (e.g. visualizer minimized) — keep the
      // loop alive so drawing resumes the moment it re-mounts.
      rafId = requestAnimationFrame(draw);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rafId = null;
      return;
    }

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    if (resolveMode() === "bars") {
      analyser.getByteFrequencyData(freqData);
      const binCount = freqData.length;
      // Cap the bar count so narrow canvases stay readable.
      const barCount = Math.max(16, Math.min(64, Math.floor(width / 6)));
      const step = binCount / barCount;
      const gap = 1;
      const barWidth = Math.max(1, width / barCount - gap);
      ctx.fillStyle = "currentColor";
      for (let i = 0; i < barCount; i++) {
        // Sample the bin range for this bar (peak keeps it lively).
        let peak = 0;
        const from = Math.floor(i * step);
        const to = Math.min(binCount, Math.ceil((i + 1) * step));
        for (let b = from; b < to; b++) {
          if (freqData[b] > peak) peak = freqData[b];
        }
        const barHeight = Math.max(1, (peak / 255) * height);
        const x = i * (barWidth + gap);
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      }
    } else {
      analyser.getByteTimeDomainData(timeData);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "currentColor";
      ctx.beginPath();
      const bufferLength = timeData.length;
      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0; // 0..2 centered on 1.0
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    rafId = requestAnimationFrame(draw);
  };

  rafId = requestAnimationFrame(draw);

  return () => {
    stopped = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/**
 * Draw the idle (not-playing) state once: a flat centerline for `line` mode,
 * a clear for `bars`. Gives the visualizer panel a "ready" look without a
 * running analyser.
 */
export function drawIdleFrame(canvas: HTMLCanvasElement, mode: AudioVisualizerMode): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (mode === "line") {
    ctx.lineWidth = 2;
    ctx.strokeStyle = "currentColor";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
}
