export type AudioVisualizerMode = 'line' | 'bars';

// The slices of an AnalyserNode, a canvas, and its 2d context the visualizer reads and draws with;
// the real Web Audio and DOM objects are each one.
export type VisualizerAnalyser = Pick<
  AnalyserNode,
  'frequencyBinCount' | 'getByteFrequencyData' | 'getByteTimeDomainData'
>;

export type VisualizerContext = Pick<
  CanvasRenderingContext2D,
  | 'clearRect'
  | 'fillRect'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'stroke'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
>;

export interface VisualizerCanvas {
  readonly width: number;
  readonly height: number;
  getContext(contextId: '2d'): VisualizerContext | null;
}

export type StartWaveformLoopOptions = {
  analyser: VisualizerAnalyser;
  getCanvas: () => VisualizerCanvas | null;
  mode?: AudioVisualizerMode | (() => AudioVisualizerMode);
};

export function startWaveformLoop(options: StartWaveformLoopOptions): () => void {
  const { analyser, getCanvas } = options;
  const resolveMode: () => AudioVisualizerMode =
    typeof options.mode === 'function'
      ? options.mode
      : () => (options.mode as AudioVisualizerMode) ?? 'line';

  const timeData = new Uint8Array(analyser.frequencyBinCount);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  let rafId: number | null = null;
  let stopped = false;

  const draw = () => {
    if (stopped) return;
    const canvas = getCanvas();
    if (!canvas) {
      rafId = requestAnimationFrame(draw);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      rafId = null;
      return;
    }

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    if (resolveMode() === 'bars') {
      analyser.getByteFrequencyData(freqData);
      const binCount = freqData.length;
      const barCount = Math.max(16, Math.min(64, Math.floor(width / 6)));
      const step = binCount / barCount;
      const gap = 1;
      const barWidth = Math.max(1, width / barCount - gap);
      ctx.fillStyle = 'currentColor';
      for (let i = 0; i < barCount; i++) {
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
      ctx.strokeStyle = 'currentColor';
      ctx.beginPath();
      const bufferLength = timeData.length;
      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0;
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

export function drawIdleFrame(canvas: VisualizerCanvas, mode: AudioVisualizerMode): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (mode === 'line') {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'currentColor';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
}
