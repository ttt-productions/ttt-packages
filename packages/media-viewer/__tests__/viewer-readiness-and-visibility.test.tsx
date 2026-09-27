import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { Profiler } from "react";
import { VideoViewer } from "../src/react/video-viewer";
import { AudioViewer } from "../src/react/audio-viewer";
import { ImageViewer } from "../src/react/image-viewer";
import { MediaViewer } from "../src/react/media-viewer";
import type { MediaDiagnosticAdapter, DiagnosisResult } from "../src/recovery";

// Each viewer's one observer: the options it passed, so a test can report visibility
// through the same `onChange` the real observer would call.
const observers: Array<{ onChange?: (inView: boolean) => void; triggerOnce?: boolean; skip?: boolean }> = [];
vi.mock("react-intersection-observer", () => ({
  useInView: (options: { onChange?: (inView: boolean) => void; triggerOnce?: boolean; skip?: boolean }) => {
    observers.push(options);
    return { ref: () => {}, inView: true, entry: { intersectionRatio: 1 } };
  },
}));

function latestObserver() {
  return observers[observers.length - 1];
}

beforeEach(() => {
  observers.length = 0;
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("metadata makes video and audio usable", () => {
  it("video: loadedmetadata alone shows the element, drops the skeleton, and fires onLoad once", () => {
    const onLoad = vi.fn();
    const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority onLoad={onLoad} />);
    const video = container.querySelector("video")!;
    expect(video).toHaveStyle({ opacity: "0" });

    fireEvent.loadedMetadata(video);

    expect(video).toHaveStyle({ opacity: "1" });
    expect(container.querySelector("[data-ai-hint]")).toBeNull();
    expect(onLoad).toHaveBeenCalledTimes(1);

    fireEvent.loadedData(video);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("audio: loadedmetadata alone shows the player and fires onLoad once", () => {
    const onLoad = vi.fn();
    const { container } = render(<AudioViewer url="https://example.com/a.mp3" priority onLoad={onLoad} />);
    const audio = container.querySelector("audio")!;
    expect(audio).toHaveStyle({ opacity: "0" });

    fireEvent.loadedMetadata(audio);

    expect(audio).toHaveStyle({ opacity: "1" });
    expect(onLoad).toHaveBeenCalledTimes(1);

    fireEvent.canPlay(audio);
    fireEvent.loadedData(audio);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});

describe("transitions use the motion tokens", () => {
  it("video, audio, and image fade with --motion-slow and --motion-ease", () => {
    const video = render(<VideoViewer url="https://example.com/v.mp4" priority />).container.querySelector("video")!;
    const audio = render(<AudioViewer url="https://example.com/a.mp3" priority />).container.querySelector("audio")!;
    const img = render(<ImageViewer url="https://example.com/i.jpg" priority />).container.querySelector("img")!;

    for (const el of [video, audio, img]) {
      expect(el.style.transition).toContain("opacity var(--motion-slow) var(--motion-ease)");
      expect(el.style.transition).not.toMatch(/\d+ms/);
    }
    expect(img.style.transition).toContain("transform var(--motion-fast) var(--motion-ease)");
  });
});

describe("a viewer reports its own visibility", () => {
  it("forwards its observer's observations to onVisibilityChange and keeps observing for the listener", () => {
    const onVisibilityChange = vi.fn();
    render(<ImageViewer url="https://example.com/i.jpg" onVisibilityChange={onVisibilityChange} />);

    const observer = latestObserver();
    expect(observer.triggerOnce).toBe(false);
    act(() => observer.onChange?.(false));
    act(() => observer.onChange?.(true));

    expect(onVisibilityChange.mock.calls).toEqual([[false], [true]]);
  });

  it("without a listener an image stops observing once it is first seen", () => {
    render(<ImageViewer url="https://example.com/i.jpg" />);
    expect(latestObserver().triggerOnce).toBe(true);
  });
});

describe("MediaPreview recovery follows the viewer's visibility", () => {
  it("renders the recovery overlay inside the failed viewer and holds the retry while it is off screen", async () => {
    vi.useFakeTimers();
    const probe = vi.fn().mockResolvedValue({ kind: "transient" } satisfies DiagnosisResult);
    const adapter: MediaDiagnosticAdapter = { probe };
    const { container } = render(
      <MediaViewer url="https://cdn.example.com/vis-check.jpg" type="image" recoveryAdapter={adapter} />,
    );

    await act(async () => {
      fireEvent.error(container.querySelector("img")!);
      await Promise.resolve();
    });
    expect(container.querySelector(".mv-recovery-retrying")).toBeInTheDocument();

    // The failed viewer still owns the one observer; it reports the viewer off screen.
    act(() => latestObserver().onChange?.(false));
    act(() => vi.advanceTimersByTime(40_000));
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".mv-recovery-retrying")).toBeInTheDocument();

    // Back on screen: the retry runs and the image is requested again.
    act(() => latestObserver().onChange?.(true));
    act(() => vi.advanceTimersByTime(40_000));
    expect(container.querySelector("img")).toBeInTheDocument();
  });
});

describe("MediaPreview listens for visibility only while its media has failed", () => {
  it("a healthy recovering preview leaves its image observer to stop once seen and never re-renders on a crossing", () => {
    const adapter: MediaDiagnosticAdapter = { probe: vi.fn() };
    let renders = 0;
    render(
      <Profiler id="preview" onRender={() => { renders += 1; }}>
        <MediaViewer url="https://cdn.example.com/healthy.jpg" type="image" recoveryAdapter={adapter} />
      </Profiler>,
    );
    const observer = latestObserver();
    expect(observer.triggerOnce).toBe(true);

    const before = renders;
    act(() => observer.onChange?.(false));
    act(() => observer.onChange?.(true));
    expect(renders).toBe(before);
  });

  it("starts listening when its image fails", async () => {
    vi.useFakeTimers();
    const probe = vi.fn().mockResolvedValue({ kind: "transient" } satisfies DiagnosisResult);
    const { container } = render(
      <MediaViewer url="https://cdn.example.com/fails.jpg" type="image" recoveryAdapter={{ probe }} />,
    );

    await act(async () => {
      fireEvent.error(container.querySelector("img")!);
      await Promise.resolve();
    });

    expect(latestObserver().triggerOnce).toBe(false);
  });
});
