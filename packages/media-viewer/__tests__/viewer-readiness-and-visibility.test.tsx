import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Profiler } from 'react';
import { VideoViewer } from '../src/react/video-viewer.js';
import { AudioViewer } from '../src/react/audio-viewer.js';
import { ImageViewer } from '../src/react/image-viewer.js';
import { MediaPreview } from '../src/react/media-viewer.js';
import type { MediaDiagnosticAdapter, DiagnosisResult } from '../src/recovery.js';
import {
  intersectionMockInstance,
  mockAllIsIntersecting,
} from 'react-intersection-observer/test-utils';

const isObserved = (element: Element): boolean => {
  try {
    intersectionMockInstance(element);
    return true;
  } catch {
    return false;
  }
};

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('metadata makes video and audio usable', () => {
  it('video: loadedmetadata alone shows the element, drops the skeleton, and fires onLoad once', () => {
    const onLoad = vi.fn();
    const { container } = render(
      <VideoViewer url="https://example.com/v.mp4" priority onLoad={onLoad} />,
    );
    const video = container.querySelector('video')!;
    expect(video).toHaveStyle({ opacity: '0' });

    fireEvent.loadedMetadata(video);

    expect(video).toHaveStyle({ opacity: '1' });
    expect(container.querySelector('[data-ai-hint]')).toBeNull();
    expect(onLoad).toHaveBeenCalledTimes(1);

    fireEvent.loadedData(video);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('audio: loadedmetadata alone shows the player and fires onLoad once', () => {
    const onLoad = vi.fn();
    const { container } = render(
      <AudioViewer url="https://example.com/a.mp3" priority onLoad={onLoad} />,
    );
    const audio = container.querySelector('audio')!;
    expect(audio).toHaveStyle({ opacity: '0' });

    fireEvent.loadedMetadata(audio);

    expect(audio).toHaveStyle({ opacity: '1' });
    expect(onLoad).toHaveBeenCalledTimes(1);

    fireEvent.canPlay(audio);
    fireEvent.loadedData(audio);
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});

describe('transitions use the motion tokens', () => {
  it('video, audio, and image fade with --motion-slow and --motion-ease', () => {
    const video = render(
      <VideoViewer url="https://example.com/v.mp4" priority />,
    ).container.querySelector('video')!;
    const audio = render(
      <AudioViewer url="https://example.com/a.mp3" priority />,
    ).container.querySelector('audio')!;
    const img = render(
      <ImageViewer url="https://example.com/i.jpg" priority />,
    ).container.querySelector('img')!;

    for (const el of [video, audio, img]) {
      expect(el.style.transition).toContain('opacity var(--motion-slow) var(--motion-ease)');
      expect(el.style.transition).not.toMatch(/\d+ms/);
    }
    expect(img.style.transition).toContain('transform var(--motion-fast) var(--motion-ease)');
  });
});

describe('a viewer reports its own visibility', () => {
  it("forwards its observer's observations to onVisibilityChange and keeps observing for the listener", () => {
    const onVisibilityChange = vi.fn();
    render(<ImageViewer url="https://example.com/i.jpg" onVisibilityChange={onVisibilityChange} />);

    mockAllIsIntersecting(true);
    mockAllIsIntersecting(false);
    mockAllIsIntersecting(true);

    expect(onVisibilityChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('without a listener an image stops observing once it is first seen', () => {
    const { container } = render(<ImageViewer url="https://example.com/i.jpg" />);
    const observed = container.firstElementChild!;
    expect(isObserved(observed)).toBe(true);

    mockAllIsIntersecting(true);

    expect(container.querySelector('img')).toBeInTheDocument();
    expect(isObserved(observed)).toBe(false);
  });
});

describe("MediaPreview recovery follows the viewer's visibility", () => {
  it('renders the recovery overlay inside the failed viewer and holds the retry while it is off screen', async () => {
    vi.useFakeTimers();
    const probe = vi.fn().mockResolvedValue({ kind: 'transient' } satisfies DiagnosisResult);
    const adapter: MediaDiagnosticAdapter = { probe };
    const { container } = render(
      <MediaPreview
        url="https://cdn.example.com/vis-check.jpg"
        type="image"
        recoveryAdapter={adapter}
      />,
    );
    mockAllIsIntersecting(true);

    await act(async () => {
      fireEvent.error(container.querySelector('img')!);
      await Promise.resolve();
    });
    expect(container.querySelector('.mv-recovery-retrying')).toBeInTheDocument();

    mockAllIsIntersecting(false);
    act(() => vi.advanceTimersByTime(40_000));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.mv-recovery-retrying')).toBeInTheDocument();

    mockAllIsIntersecting(true);
    act(() => vi.advanceTimersByTime(40_000));
    mockAllIsIntersecting(true);
    expect(container.querySelector('img')).toBeInTheDocument();
  });
});

describe('MediaPreview listens for visibility only while its media has failed', () => {
  it('a healthy recovering preview leaves its image observer to stop once seen and never re-renders on a crossing', () => {
    const adapter: MediaDiagnosticAdapter = { probe: vi.fn() };
    let renders = 0;
    const { container } = render(
      <Profiler
        id="preview"
        onRender={() => {
          renders += 1;
        }}
      >
        <MediaPreview
          url="https://cdn.example.com/healthy.jpg"
          type="image"
          recoveryAdapter={adapter}
        />
      </Profiler>,
    );
    mockAllIsIntersecting(true);
    expect(container.querySelector('img')).toBeInTheDocument();

    const before = renders;
    mockAllIsIntersecting(false);
    mockAllIsIntersecting(true);
    expect(renders).toBe(before);
  });

  it('starts listening when its image fails: an off-screen crossing then holds the retry', async () => {
    vi.useFakeTimers();
    const probe = vi.fn().mockResolvedValue({ kind: 'transient' } satisfies DiagnosisResult);
    const { container } = render(
      <MediaPreview
        url="https://cdn.example.com/fails.jpg"
        type="image"
        recoveryAdapter={{ probe }}
      />,
    );
    mockAllIsIntersecting(true);

    await act(async () => {
      fireEvent.error(container.querySelector('img')!);
      await Promise.resolve();
    });
    mockAllIsIntersecting(false);
    act(() => vi.advanceTimersByTime(40_000));

    expect(container.querySelector('img')).toBeNull();
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
