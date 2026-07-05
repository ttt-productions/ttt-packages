import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { VideoViewer } from '../src/react/video-viewer';
import { AudioViewer } from '../src/react/audio-viewer';
import { PROGRESS_SAMPLE_INTERVAL_MS } from '../src/react/use-media-playback';
import type { MediaPlaybackControls } from '../src/types';

// The video-viewer's autoplay/unload logic reads useInView. Keep the element
// mounted and non-autoplaying by default (inView true, ratio 0 => not >= 0.5).
let mockInView = true;
let mockRatio = 0;
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: () => {},
    inView: mockInView,
    entry: { intersectionRatio: mockRatio } as unknown as IntersectionObserverEntry,
  }),
}));

beforeEach(() => {
  mockInView = true;
  mockRatio = 0;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/**
 * jsdom leaves media props as inert 0/false. Install writable instance-level
 * currentTime/duration/paused/ended so the hook can read/write them and tests
 * can drive playback state.
 */
function installMediaState(
  el: HTMLMediaElement,
  init: { currentTime?: number; duration?: number; paused?: boolean; ended?: boolean } = {},
) {
  let currentTime = init.currentTime ?? 0;
  let paused = init.paused ?? true;
  let ended = init.ended ?? false;
  let duration = init.duration ?? 100;
  Object.defineProperty(el, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: (v: number) => {
      currentTime = v;
    },
  });
  Object.defineProperty(el, 'duration', {
    configurable: true,
    get: () => duration,
    set: (v: number) => {
      duration = v;
    },
  });
  Object.defineProperty(el, 'paused', {
    configurable: true,
    get: () => paused,
    set: (v: boolean) => {
      paused = v;
    },
  });
  Object.defineProperty(el, 'ended', {
    configurable: true,
    get: () => ended,
    set: (v: boolean) => {
      ended = v;
    },
  });
  return {
    setTime: (v: number) => {
      currentTime = v;
    },
    setPaused: (v: boolean) => {
      paused = v;
    },
    setEnded: (v: boolean) => {
      ended = v;
    },
    setDuration: (v: number) => {
      duration = v;
    },
    get currentTime() {
      return currentTime;
    },
  };
}

describe('media playback API', () => {
  // ---- onEnded ------------------------------------------------------------
  describe('onEnded', () => {
    it('fires onEnded when the video ends', () => {
      const onEnded = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onEnded={onEnded} />,
      );
      const video = container.querySelector('video')!;
      installMediaState(video, { currentTime: 100, duration: 100, ended: true });
      fireEvent.ended(video);
      expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it('fires onEnded for audio too', () => {
      const onEnded = vi.fn();
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority onEnded={onEnded} />,
      );
      const audio = container.querySelector('audio')!;
      installMediaState(audio, { currentTime: 30, duration: 30, ended: true });
      fireEvent.ended(audio);
      expect(onEnded).toHaveBeenCalledTimes(1);
    });
  });

  // ---- onProgressSample throttling + flushes ------------------------------
  describe('onProgressSample', () => {
    it('throttles periodic samples to ~one per interval of playback', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: false, duration: 100 });

      // First timeupdate while playing -> sample fires immediately (0 elapsed).
      state.setTime(1);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(1, 100);

      // A second timeupdate a moment later (< interval) must NOT sample again.
      state.setTime(2);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(1);

      // Advance real wall-clock past the throttle interval and fire again.
      const realNow = Date.now();
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(realNow + PROGRESS_SAMPLE_INTERVAL_MS + 10);
      state.setTime(8);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(2);
      expect(onSample).toHaveBeenLastCalledWith(8, 100);
      nowSpy.mockRestore();
    });

    it('does not sample while paused (timeupdate ignored when paused)', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: true, duration: 100 });
      state.setTime(5);
      fireEvent.timeUpdate(video);
      expect(onSample).not.toHaveBeenCalled();
    });

    it('flushes a sample immediately on pause', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: true, duration: 100 });
      state.setTime(12);
      fireEvent.pause(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(12, 100);
    });

    it('flushes a sample on seek completion', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: true, duration: 100 });
      state.setTime(42);
      fireEvent.seeked(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(42, 100);
    });

    it('flushes a final sample on ended with the final position', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      installMediaState(video, { currentTime: 100, duration: 100, ended: true });
      fireEvent.ended(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(100, 100);
    });

    it('reports duration 0 until known', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: false, duration: NaN });
      state.setTime(3);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenLastCalledWith(3, 0);
    });
  });

  // ---- startAtSeconds initial application ---------------------------------
  describe('startAtSeconds', () => {
    it('seeks to startAtSeconds once metadata is available', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority startAtSeconds={30} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video);
      expect(state.currentTime).toBe(30);
    });

    it('does not seek when startAtSeconds is absent', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video);
      expect(state.currentTime).toBe(0);
    });

    it('clamps startAtSeconds to the known duration', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority startAtSeconds={9999} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 60 });
      fireEvent.loadedMetadata(video);
      expect(state.currentTime).toBe(60);
    });
  });

  // ---- startAtSeconds survives the unloadOnExit unload/remount ------------
  describe('startAtSeconds + unloadOnExit remount resume', () => {
    it('resumes from the last known position after unload/remount, not startAtSeconds and not 0', () => {
      mockInView = true;
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" startAtSeconds={10} />,
      );
      const video1 = container.querySelector('video')!;
      const s1 = installMediaState(video1, { currentTime: 0, duration: 100, paused: false });

      // Initial seek applies startAtSeconds (10).
      fireEvent.loadedMetadata(video1);
      expect(s1.currentTime).toBe(10);

      // Playback advances to 55 and we observe a timeupdate (marks "started").
      s1.setTime(55);
      fireEvent.timeUpdate(video1);

      // Scroll off-screen -> VideoViewer unloads the element (unmounts <video>).
      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" startAtSeconds={10} />);
      expect(container.querySelector('video')).toBeNull();

      // Scroll back on-screen -> a fresh <video> mounts at currentTime 0.
      mockInView = true;
      rerender(<VideoViewer url="https://example.com/v.mp4" startAtSeconds={10} />);
      const video2 = container.querySelector('video')!;
      expect(video2).not.toBe(video1);
      const s2 = installMediaState(video2, { currentTime: 0, duration: 100 });

      // Metadata on the remounted element resumes from the LAST position (55),
      // not the original startAtSeconds (10) and not 0.
      fireEvent.loadedMetadata(video2);
      expect(s2.currentTime).toBe(55);
    });

    it('does NOT carry a stale position onto a different media source (url change)', () => {
      mockInView = true;
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/a.mp4" priority />,
      );
      const video1 = container.querySelector('video')!;
      const s1 = installMediaState(video1, { currentTime: 0, duration: 100, paused: false });

      // Play media A to 55 and observe a timeupdate (marks "started").
      s1.setTime(55);
      fireEvent.timeUpdate(video1);
      expect(s1.currentTime).toBe(55);

      // Swap the SAME viewer instance to a DIFFERENT media source. The element is
      // reused (no unmount) but the source is new, so tracking must reset — the
      // 55s position from media A must NOT be applied to media B.
      rerender(<VideoViewer url="https://example.com/b.mp4" priority />);
      const video2 = container.querySelector('video')!;
      const s2 = installMediaState(video2, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video2);
      expect(s2.currentTime).toBe(0);
    });

    it('applies the CURRENT startAtSeconds after a url change, not the previous one', () => {
      mockInView = true;
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/a.mp4" priority startAtSeconds={10} />,
      );
      const video1 = container.querySelector('video')!;
      const s1 = installMediaState(video1, { currentTime: 0, duration: 100, paused: false });
      fireEvent.loadedMetadata(video1);
      expect(s1.currentTime).toBe(10);
      s1.setTime(80);
      fireEvent.timeUpdate(video1);

      // New source with a new startAtSeconds -> seek to the NEW value (25), not
      // the old start (10) and not the last position on media A (80).
      rerender(<VideoViewer url="https://example.com/b.mp4" priority startAtSeconds={25} />);
      const video2 = container.querySelector('video')!;
      const s2 = installMediaState(video2, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video2);
      expect(s2.currentTime).toBe(25);
    });
  });

  // ---- endOverlay show/hide ----------------------------------------------
  describe('endOverlay', () => {
    it('shows the overlay when the media ends and hides on replay', () => {
      const { container, queryByTestId } = render(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          endOverlay={<div data-testid="end-ov">done</div>}
        />,
      );
      const video = container.querySelector('video')!;
      installMediaState(video, { currentTime: 100, duration: 100 });
      expect(queryByTestId('end-ov')).not.toBeInTheDocument();

      fireEvent.ended(video);
      expect(queryByTestId('end-ov')).toBeInTheDocument();

      // Native replay fires play -> overlay removed.
      fireEvent.play(video);
      expect(queryByTestId('end-ov')).not.toBeInTheDocument();
    });

    it('does not render the overlay container when endOverlay is absent', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      const video = container.querySelector('video')!;
      installMediaState(video, { currentTime: 100, duration: 100 });
      fireEvent.ended(video);
      expect(container.querySelector('.mv-end-overlay')).toBeNull();
    });

    it('shows the overlay for audio on end', () => {
      const { container, queryByTestId } = render(
        <AudioViewer
          url="https://example.com/a.mp3"
          priority
          endOverlay={<div data-testid="a-end">done</div>}
        />,
      );
      const audio = container.querySelector('audio')!;
      installMediaState(audio, { currentTime: 20, duration: 20 });
      fireEvent.ended(audio);
      expect(queryByTestId('a-end')).toBeInTheDocument();
    });
  });

  // ---- imperative controls ------------------------------------------------
  describe('playbackControlsRef', () => {
    it('restart() seeks to 0 and plays and clears the overlay', () => {
      const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const ref = React.createRef<MediaPlaybackControls>();
      const { container, queryByTestId } = render(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          playbackControlsRef={ref}
          endOverlay={<div data-testid="end-ov">done</div>}
        />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 100, duration: 100 });
      fireEvent.ended(video);
      expect(queryByTestId('end-ov')).toBeInTheDocument();

      act(() => {
        ref.current!.restart();
      });
      expect(state.currentTime).toBe(0);
      expect(playSpy).toHaveBeenCalled();
      expect(queryByTestId('end-ov')).not.toBeInTheDocument();
    });

    it('seekTo() sets currentTime clamped to [0, duration]', () => {
      const ref = React.createRef<MediaPlaybackControls>();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority playbackControlsRef={ref} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 100 });

      act(() => {
        ref.current!.seekTo(42);
      });
      expect(state.currentTime).toBe(42);

      act(() => {
        ref.current!.seekTo(9999);
      });
      expect(state.currentTime).toBe(100);

      act(() => {
        ref.current!.seekTo(-5);
      });
      expect(state.currentTime).toBe(0);
    });

    it('exposes controls for audio too', () => {
      const ref = React.createRef<MediaPlaybackControls>();
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority playbackControlsRef={ref} />,
      );
      const audio = container.querySelector('audio')!;
      const state = installMediaState(audio, { currentTime: 0, duration: 50 });
      act(() => {
        ref.current!.seekTo(25);
      });
      expect(state.currentTime).toBe(25);
    });
  });

  // ---- no-regression when new props absent --------------------------------
  describe('no-regression (new props absent)', () => {
    it('renders and behaves normally with no playback props (video)', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onLoad={onLoad} />,
      );
      const video = container.querySelector('video')!;
      expect(video).not.toBeNull();
      // Firing media events with no handlers wired must not throw.
      installMediaState(video, { currentTime: 5, duration: 100, paused: false });
      expect(() => {
        fireEvent.loadedMetadata(video);
        fireEvent.timeUpdate(video);
        fireEvent.pause(video);
        fireEvent.seeked(video);
        fireEvent.ended(video);
      }).not.toThrow();
      fireEvent.loadedData(video);
      expect(onLoad).toHaveBeenCalled();
    });

    it('renders and behaves normally with no playback props (audio)', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" priority />);
      const audio = container.querySelector('audio')!;
      installMediaState(audio, { currentTime: 5, duration: 50, paused: false });
      expect(() => {
        fireEvent.loadedMetadata(audio);
        fireEvent.timeUpdate(audio);
        fireEvent.pause(audio);
        fireEvent.seeked(audio);
        fireEvent.ended(audio);
      }).not.toThrow();
    });
  });
});
