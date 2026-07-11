import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startWaveformLoop, drawIdleFrame } from "../src/visualizer";
import type { AudioVisualizerMode } from "../src/visualizer";

type RafCallback = (t: number) => void;

// Manual rAF pump: frames advance only when we say so.
let rafCallbacks: Map<number, RafCallback>;
let nextRafId: number;

function pumpFrame() {
  const pending = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  for (const [, cb] of pending) cb(performance.now());
}

function makeCanvasMock() {
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    lineWidth: 0,
    strokeStyle: "",
    fillStyle: "",
  };
  const canvas = {
    width: 300,
    height: 100,
    getContext: vi.fn().mockReturnValue(ctx),
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}

function makeAnalyserMock() {
  return {
    frequencyBinCount: 128,
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => arr.fill(128)),
    getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(200)),
  } as unknown as AnalyserNode;
}

beforeEach(() => {
  rafCallbacks = new Map();
  nextRafId = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: RafCallback) => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startWaveformLoop", () => {
  it("line mode reads time-domain data and strokes a path each frame", () => {
    const { canvas, ctx } = makeCanvasMock();
    const analyser = makeAnalyserMock();
    const stop = startWaveformLoop({ analyser, getCanvas: () => canvas, mode: "line" });

    pumpFrame();
    expect(analyser.getByteTimeDomainData).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).not.toHaveBeenCalled();

    pumpFrame();
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    stop();
  });

  it("bars mode reads frequency data and fills bars each frame", () => {
    const { canvas, ctx } = makeCanvasMock();
    const analyser = makeAnalyserMock();
    const stop = startWaveformLoop({ analyser, getCanvas: () => canvas, mode: "bars" });

    pumpFrame();
    expect(analyser.getByteFrequencyData).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
    stop();
  });

  it("a mode getter is resolved every frame (live toggling)", () => {
    const { canvas, ctx } = makeCanvasMock();
    const analyser = makeAnalyserMock();
    let mode: AudioVisualizerMode = "line";
    const stop = startWaveformLoop({ analyser, getCanvas: () => canvas, mode: () => mode });

    pumpFrame();
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    mode = "bars";
    pumpFrame();
    expect(ctx.fillRect).toHaveBeenCalled();
    stop();
  });

  it("keeps the loop alive while the canvas is unmounted and draws again when it returns", () => {
    const { canvas, ctx } = makeCanvasMock();
    const analyser = makeAnalyserMock();
    let mounted = false;
    const stop = startWaveformLoop({ analyser, getCanvas: () => (mounted ? canvas : null), mode: "line" });

    pumpFrame();
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(1); // still scheduled

    mounted = true;
    pumpFrame();
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stop() cancels the loop and no further frames draw", () => {
    const { canvas, ctx } = makeCanvasMock();
    const analyser = makeAnalyserMock();
    const stop = startWaveformLoop({ analyser, getCanvas: () => canvas, mode: "line" });

    pumpFrame();
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    stop();
    expect(rafCallbacks.size).toBe(0);
    pumpFrame();
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it("self-terminates when the canvas has no 2d context", () => {
    const canvas = {
      width: 300,
      height: 100,
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement;
    const analyser = makeAnalyserMock();
    const stop = startWaveformLoop({ analyser, getCanvas: () => canvas, mode: "line" });

    pumpFrame();
    expect(rafCallbacks.size).toBe(0);
    stop();
  });
});

describe("drawIdleFrame", () => {
  it("draws a flat centerline in line mode", () => {
    const { canvas, ctx } = makeCanvasMock();
    drawIdleFrame(canvas, "line");
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 50);
    expect(ctx.lineTo).toHaveBeenCalledWith(300, 50);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("only clears in bars mode", () => {
    const { canvas, ctx } = makeCanvasMock();
    drawIdleFrame(canvas, "bars");
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
