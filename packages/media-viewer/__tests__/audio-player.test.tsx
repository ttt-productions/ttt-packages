import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AudioViewer } from "../src/react/audio-viewer";
import { AudioPlayer } from "../src/react/audio-player";

vi.mock("react-intersection-observer", () => ({
  useInView: () => ({ ref: () => {}, inView: true }),
}));

// jsdom canvas has no 2d context by default — the visualizer no-ops cleanly,
// which is exactly the production best-effort posture. rAF is stubbed so the
// loop never spins during tests.
function installAudioContextMock() {
  const analyser = {
    fftSize: 0,
    frequencyBinCount: 128,
    getByteTimeDomainData: vi.fn(),
    getByteFrequencyData: vi.fn(),
    connect: vi.fn(),
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const instances: Array<{ close: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> }> = [];
  const ctor = vi.fn(function (this: Record<string, unknown>) {
    const inst = {
      state: "running",
      destination: {},
      close: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      createMediaElementSource: vi.fn().mockReturnValue(source),
      createAnalyser: vi.fn().mockReturnValue(analyser),
    };
    instances.push(inst as never);
    Object.assign(this, inst);
  });
  (globalThis as { AudioContext?: unknown }).AudioContext = ctor;
  return { ctor, source, analyser, instances };
}

let audioCtxMock: ReturnType<typeof installAudioContextMock>;

// jsdom never flips `paused`, so the play/pause mocks track it themselves —
// togglePlay branches on it.
const pausedState = new WeakMap<HTMLMediaElement, boolean>();
const originalPausedDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "paused");

beforeEach(() => {
  window.localStorage.clear();
  audioCtxMock = installAudioContextMock();
  vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValue(1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get(this: HTMLMediaElement) {
      return pausedState.get(this) ?? true;
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    pausedState.set(this, true);
    fireEvent.pause(this);
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    pausedState.set(this, false);
    fireEvent.play(this);
    return Promise.resolve();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalPausedDescriptor) {
    Object.defineProperty(HTMLMediaElement.prototype, "paused", originalPausedDescriptor);
  }
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
});

function renderPlayer(extra?: Partial<React.ComponentProps<typeof AudioViewer>>) {
  return render(
    <AudioViewer url="https://example.com/a.mp3" priority chrome="player" {...extra} />
  );
}

describe("AudioViewer chrome='player'", () => {
  it("renders the custom chrome and disables native controls", () => {
    const { container } = renderPlayer();
    expect(container.querySelector("[data-mv-player]")).toBeInTheDocument();
    const audio = container.querySelector("audio")!;
    expect(audio).toBeInTheDocument();
    expect(audio).not.toHaveAttribute("controls");
    // No tap-to-toggle container semantics with real buttons present.
    expect(container.querySelector('[role="button"][aria-label="Toggle audio playback"]')).toBeNull();
  });

  it("play button plays the element and flips to Pause on the play event", () => {
    const { container, getByLabelText } = renderPlayer();
    fireEvent.click(getByLabelText("Play"));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(getByLabelText("Pause")).toBeInTheDocument();
    fireEvent.click(getByLabelText("Pause"));
    expect(getByLabelText("Play")).toBeInTheDocument();
    void container;
  });

  it("builds the Web Audio graph on first play: element source → analyser → destination", () => {
    const { getByLabelText } = renderPlayer();
    expect(audioCtxMock.ctor).not.toHaveBeenCalled();
    fireEvent.click(getByLabelText("Play"));
    expect(audioCtxMock.ctor).toHaveBeenCalledTimes(1);
    expect(audioCtxMock.source.connect).toHaveBeenCalled(); // → analyser
    expect(audioCtxMock.analyser.connect).toHaveBeenCalled(); // → destination
    // Second play does not rebuild the graph for the same element.
    fireEvent.click(getByLabelText("Pause"));
    fireEvent.click(getByLabelText("Play"));
    expect(audioCtxMock.ctor).toHaveBeenCalledTimes(1);
  });

  it("seek slider commits currentTime on release", () => {
    const { container } = renderPlayer();
    const audio = container.querySelector("audio")!;
    Object.defineProperty(audio, "duration", { configurable: true, get: () => 100 });
    fireEvent.durationChange(audio);

    const seek = container.querySelector<HTMLInputElement>(".mv-player-seek")!;
    expect(seek.disabled).toBe(false);
    fireEvent.change(seek, { target: { value: "42" } });
    fireEvent.mouseUp(seek);
    expect(audio.currentTime).toBe(42);
  });

  it("mute button toggles element muted state", () => {
    const { container, getByLabelText } = renderPlayer();
    const audio = container.querySelector<HTMLAudioElement>("audio")!;
    expect(audio.muted).toBe(false);
    fireEvent.click(getByLabelText("Mute"));
    expect(audio.muted).toBe(true);
    fireEvent.volumeChange(audio);
    expect(getByLabelText("Unmute")).toBeInTheDocument();
  });

  it("minimize hides the visualizer panel, persists, and is restored on a fresh render", () => {
    const first = renderPlayer();
    expect(first.container.querySelector(".mv-player-viz")).toBeInTheDocument();
    fireEvent.click(first.getByLabelText("Hide visualizer"));
    expect(first.container.querySelector(".mv-player-viz")).toBeNull();
    expect(first.container.querySelector("[data-mv-player]")).toHaveAttribute("data-minimized", "true");
    expect(window.localStorage.getItem("mv-audio-player:minimized")).toBe("1");
    first.unmount();

    const second = renderPlayer();
    expect(second.container.querySelector(".mv-player-viz")).toBeNull();
    expect(second.getByLabelText("Show visualizer")).toBeInTheDocument();
  });

  it("mode toggle flips bars↔line and persists", () => {
    const { container, getByLabelText } = renderPlayer();
    expect(container.querySelector("[data-mv-player]")).toHaveAttribute("data-mode", "bars");
    fireEvent.click(getByLabelText("Switch visualizer to waveform line"));
    expect(container.querySelector("[data-mv-player]")).toHaveAttribute("data-mode", "line");
    expect(window.localStorage.getItem("mv-audio-player:mode")).toBe("line");
  });

  it("persistKey=null disables persistence", () => {
    const { getByLabelText } = renderPlayer({ persistKey: null });
    fireEvent.click(getByLabelText("Hide visualizer"));
    expect(window.localStorage.getItem("mv-audio-player:minimized")).toBeNull();
  });

  it("renders extraActions in the control row", () => {
    const { getByText } = renderPlayer({ extraActions: <button type="button">Ink It</button> });
    expect(getByText("Ink It")).toBeInTheDocument();
  });

  it("visualizerMode prop sets the initial mode when nothing is persisted", () => {
    const { container } = renderPlayer({ visualizerMode: "line" });
    expect(container.querySelector("[data-mv-player]")).toHaveAttribute("data-mode", "line");
  });

  it("default native chrome is unchanged (controls attribute present, no player chrome)", () => {
    const { container } = render(<AudioViewer url="https://example.com/a.mp3" priority />);
    expect(container.querySelector("audio")).toHaveAttribute("controls");
    expect(container.querySelector("[data-mv-player]")).toBeNull();
  });
});

describe("AudioPlayer named export", () => {
  it("renders AudioViewer with player chrome", () => {
    const { container } = render(<AudioPlayer url="https://example.com/a.mp3" priority />);
    expect(container.querySelector("[data-mv-player]")).toBeInTheDocument();
    expect(container.querySelector("audio")).not.toHaveAttribute("controls");
  });
});
