import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { VideoViewer } from '../src/react/video-viewer.js';
import { AudioViewer } from '../src/react/audio-viewer.js';
import {
  PROGRESS_SAMPLE_INTERVAL_MS,
  LATE_RESUME_ADOPT_WINDOW_SEC,
} from '../src/react/use-media-playback.js';
import type { MediaPlaybackControls } from '../src/types.js';

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

/** jsdom leaves media props as inert 0/false, so these are writable per instance. */
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

  describe('onProgressSample', () => {
    it('throttles periodic samples to ~one per interval of playback', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: false, duration: 100 });

      state.setTime(LATE_RESUME_ADOPT_WINDOW_SEC + 1);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(LATE_RESUME_ADOPT_WINDOW_SEC + 1, 100, 'periodic');

      state.setTime(LATE_RESUME_ADOPT_WINDOW_SEC + 2);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(1);

      const realNow = Date.now();
      const nowSpy = vi
        .spyOn(Date, 'now')
        .mockReturnValue(realNow + PROGRESS_SAMPLE_INTERVAL_MS + 10);
      state.setTime(8);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(2);
      expect(onSample).toHaveBeenLastCalledWith(8, 100, 'periodic');
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
      expect(onSample).toHaveBeenLastCalledWith(12, 100, 'pause');
    });

    it('flushes a pause sample inside the suppression window (a pause at 0.5s is user intent)', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          autoPlay
          onProgressSample={onSample}
        />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: false, duration: 100 });

      state.setTime(0.5);
      fireEvent.timeUpdate(video);
      expect(onSample).not.toHaveBeenCalled();

      state.setPaused(true);
      fireEvent.pause(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(0.5, 100, 'pause');
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
      expect(onSample).toHaveBeenLastCalledWith(42, 100, 'seeked');
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
      expect(onSample).toHaveBeenLastCalledWith(100, 100, 'ended');
    });

    it('reports duration 0 until known', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: false, duration: NaN });
      state.setTime(10);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenLastCalledWith(10, 0, 'periodic');
    });

    it('resets the periodic throttle clock on a media-key (source) change', () => {
      const onSample = vi.fn();
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/a.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { paused: false, duration: 100 });

      state.setTime(20);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(20, 100, 'periodic');

      rerender(
        <VideoViewer url="https://example.com/b.mp4" priority onProgressSample={onSample} />,
      );
      state.setTime(LATE_RESUME_ADOPT_WINDOW_SEC + 1);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(2);
      expect(onSample).toHaveBeenLastCalledWith(LATE_RESUME_ADOPT_WINDOW_SEC + 1, 100, 'periodic');
    });
  });

  describe('pre-seed periodic suppression', () => {
    it('emits no periodic sample inside the adoption window while autoplaying from 0', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          autoPlay
          onProgressSample={onSample}
        />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 300, paused: false });
      fireEvent.loadedMetadata(video);

      for (const t of [0.2, 1, 2.5, LATE_RESUME_ADOPT_WINDOW_SEC]) {
        state.setTime(t);
        fireEvent.timeUpdate(video);
      }
      expect(onSample).not.toHaveBeenCalled();
    });

    it('starts periodic sampling after the window when no resume position ever arrives', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          autoPlay
          onProgressSample={onSample}
        />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 300, paused: false });
      fireEvent.loadedMetadata(video);

      state.setTime(LATE_RESUME_ADOPT_WINDOW_SEC);
      fireEvent.timeUpdate(video);
      expect(onSample).not.toHaveBeenCalled();

      state.setTime(LATE_RESUME_ADOPT_WINDOW_SEC + 0.5);
      fireEvent.timeUpdate(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(
        LATE_RESUME_ADOPT_WINDOW_SEC + 0.5,
        300,
        'periodic',
      );
    });

    it('stays source-compatible with a two-argument consumer', () => {
      const seen: Array<[number, number]> = [];
      const twoArg = (t: number, d: number) => {
        seen.push([t, d]);
      };
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={twoArg} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { duration: 100, paused: true });
      state.setTime(12);
      fireEvent.pause(video);
      expect(seen).toEqual([[12, 100]]);
    });

    it('reports the RESUMED position as the first sample when a late seed lands (reason seeked)', () => {
      const onSample = vi.fn();
      const { container, rerender } = render(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          autoPlay
          onProgressSample={onSample}
        />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 300, paused: false });
      fireEvent.loadedMetadata(video);

      state.setTime(0.2);
      fireEvent.timeUpdate(video);
      expect(onSample).not.toHaveBeenCalled();

      rerender(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          autoPlay
          startAtSeconds={224}
          onProgressSample={onSample}
        />,
      );
      expect(state.currentTime).toBe(224);
      fireEvent.seeked(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(224, 300, 'seeked');
    });
  });

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

  describe('startAtSeconds + unloadOnExit remount resume', () => {
    it('resumes from the last known position after unload/remount, not startAtSeconds and not 0', () => {
      mockInView = true;
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" startAtSeconds={10} />,
      );
      const video1 = container.querySelector('video')!;
      const s1 = installMediaState(video1, { currentTime: 0, duration: 100, paused: false });

      fireEvent.loadedMetadata(video1);
      expect(s1.currentTime).toBe(10);

      s1.setTime(55);
      fireEvent.timeUpdate(video1);

      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" startAtSeconds={10} />);
      expect(container.querySelector('video')).toBeNull();

      mockInView = true;
      rerender(<VideoViewer url="https://example.com/v.mp4" startAtSeconds={10} />);
      const video2 = container.querySelector('video')!;
      expect(video2).not.toBe(video1);
      const s2 = installMediaState(video2, { currentTime: 0, duration: 100 });

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

      s1.setTime(55);
      fireEvent.timeUpdate(video1);
      expect(s1.currentTime).toBe(55);

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

      rerender(<VideoViewer url="https://example.com/b.mp4" priority startAtSeconds={25} />);
      const video2 = container.querySelector('video')!;
      const s2 = installMediaState(video2, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video2);
      expect(s2.currentTime).toBe(25);
    });
  });

  describe('startAtSeconds arriving after mount', () => {
    it('adopts a late startAtSeconds and seeks the already-loaded element', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 100 });

      fireEvent.loadedMetadata(video);
      expect(state.currentTime).toBe(0);

      rerender(<VideoViewer url="https://example.com/v.mp4" priority startAtSeconds={42} />);
      expect(state.currentTime).toBe(42);
    });

    it('adopts a late startAtSeconds for audio too', () => {
      const { container, rerender } = render(
        <AudioViewer url="https://example.com/a.mp3" priority />,
      );
      const audio = container.querySelector('audio')!;
      const state = installMediaState(audio, { currentTime: 0, duration: 50 });
      fireEvent.loadedMetadata(audio);
      expect(state.currentTime).toBe(0);

      rerender(<AudioViewer url="https://example.com/a.mp3" priority startAtSeconds={20} />);
      expect(state.currentTime).toBe(20);
    });

    it('clamps a late startAtSeconds to the known duration', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 60 });
      fireEvent.loadedMetadata(video);

      rerender(<VideoViewer url="https://example.com/v.mp4" priority startAtSeconds={9999} />);
      expect(state.currentTime).toBe(60);
    });

    it('IGNORES a late startAtSeconds once real playback has begun (beyond the adoption window)', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 100, paused: false });
      fireEvent.loadedMetadata(video);

      state.setTime(5);
      fireEvent.timeUpdate(video);

      rerender(<VideoViewer url="https://example.com/v.mp4" priority startAtSeconds={42} />);
      expect(state.currentTime).toBe(5);
    });

    it('ADOPTS a late startAtSeconds while autoplay has only drifted within the adoption window', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 300, paused: false });
      fireEvent.loadedMetadata(video);

      state.setTime(0.2);
      fireEvent.timeUpdate(video);

      rerender(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay startAtSeconds={224} />,
      );
      expect(state.currentTime).toBe(224);
    });

    it('adopts a late value EXACTLY once — a second late change never re-yanks', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 300, paused: false });
      fireEvent.loadedMetadata(video);
      state.setTime(0.2);
      fireEvent.timeUpdate(video);

      rerender(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay startAtSeconds={224} />,
      );
      expect(state.currentTime).toBe(224);

      state.setTime(230);
      fireEvent.timeUpdate(video);
      rerender(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay startAtSeconds={50} />,
      );
      expect(state.currentTime).toBe(230);
    });

    it('keeps the tracked position truthful after an ignored late startAtSeconds', () => {
      mockInView = true;
      const { container, rerender } = render(<VideoViewer url="https://example.com/v.mp4" />);
      const video1 = container.querySelector('video')!;
      const s1 = installMediaState(video1, { currentTime: 0, duration: 100, paused: false });
      fireEvent.loadedMetadata(video1);
      s1.setTime(55);
      fireEvent.timeUpdate(video1);

      rerender(<VideoViewer url="https://example.com/v.mp4" startAtSeconds={42} />);
      expect(s1.currentTime).toBe(55);

      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" startAtSeconds={42} />);
      expect(container.querySelector('video')).toBeNull();
      mockInView = true;
      rerender(<VideoViewer url="https://example.com/v.mp4" startAtSeconds={42} />);
      const video2 = container.querySelector('video')!;
      const s2 = installMediaState(video2, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video2);
      expect(s2.currentTime).toBe(55);
    });

    it('does not seek when startAtSeconds stays undefined across rerenders', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video);
      rerender(<VideoViewer url="https://example.com/v.mp4" priority />);
      rerender(<VideoViewer url="https://example.com/v.mp4" priority startAtSeconds={undefined} />);
      fireEvent.loadedMetadata(video);
      expect(state.currentTime).toBe(0);
    });

    it('re-arms after a media-key change: a late startAtSeconds for the NEW source applies', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/a.mp4" priority />,
      );
      const video = container.querySelector('video')!;
      const s1 = installMediaState(video, { currentTime: 0, duration: 100, paused: false });
      fireEvent.loadedMetadata(video);
      s1.setTime(80);
      fireEvent.timeUpdate(video);

      rerender(<VideoViewer url="https://example.com/b.mp4" priority />);
      const s2 = installMediaState(video, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video);
      expect(s2.currentTime).toBe(0);

      rerender(<VideoViewer url="https://example.com/b.mp4" priority startAtSeconds={25} />);
      expect(s2.currentTime).toBe(25);
    });
  });

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

  describe('active-element retirement', () => {
    function installTeardownBurst(state: ReturnType<typeof installMediaState>) {
      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
        this: HTMLMediaElement,
      ) {
        state.setPaused(true);
        this.dispatchEvent(new Event('pause'));
      });
      vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (
        this: HTMLMediaElement,
      ) {
        state.setTime(0);
        this.dispatchEvent(new Event('timeupdate'));
        this.dispatchEvent(new Event('seeked'));
        this.dispatchEvent(new Event('pause'));
      });
    }

    it('ignores the unload teardown burst after a scrub — only the scrubbed position is ever emitted', () => {
      mockInView = true;
      const onSample = vi.fn();
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 300, paused: false });
      fireEvent.loadedMetadata(video);

      state.setTime(50);
      fireEvent.timeUpdate(video);
      state.setTime(224);
      fireEvent.seeked(video);
      expect(onSample).toHaveBeenLastCalledWith(224, 300, 'seeked');
      const callsAfterScrub = onSample.mock.calls.length;

      installTeardownBurst(state);
      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" onProgressSample={onSample} />);
      expect(container.querySelector('video')).toBeNull();

      expect(onSample.mock.calls.length).toBe(callsAfterScrub);
      expect(onSample.mock.calls.some(([t]) => t === 0)).toBe(false);
    });

    it('retires BEFORE its explicit source reset — commits the live cursor once and remounts there', () => {
      mockInView = true;
      const onSample = vi.fn();
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" onProgressSample={onSample} />,
      );
      const video1 = container.querySelector('video')!;
      const s1 = installMediaState(video1, { currentTime: 0, duration: 100, paused: false });
      fireEvent.loadedMetadata(video1);

      s1.setTime(55);
      fireEvent.timeUpdate(video1);

      installTeardownBurst(s1);
      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" onProgressSample={onSample} />);
      expect(onSample).toHaveBeenLastCalledWith(55, 100, 'pause');
      expect(onSample.mock.calls.some(([t]) => t === 0)).toBe(false);

      vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
      vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
      mockInView = true;
      rerender(<VideoViewer url="https://example.com/v.mp4" onProgressSample={onSample} />);
      const video2 = container.querySelector('video')!;
      expect(video2).not.toBe(video1);
      const s2 = installMediaState(video2, { currentTime: 0, duration: 100 });
      fireEvent.loadedMetadata(video2);
      expect(s2.currentTime).toBe(55);
    });

    it('ignores old-source teardown events after a URL switch; the new source reports after it settles', () => {
      const onSample = vi.fn();
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/a.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 100, paused: false });
      fireEvent.loadedMetadata(video);
      state.setTime(55);
      fireEvent.timeUpdate(video);
      const callsOnA = onSample.mock.calls.length;

      rerender(
        <VideoViewer url="https://example.com/b.mp4" priority onProgressSample={onSample} />,
      );
      state.setTime(0);
      state.setPaused(true);
      fireEvent.pause(video);
      fireEvent.seeked(video);
      expect(onSample.mock.calls.length).toBe(callsOnA);

      fireEvent.loadedMetadata(video);
      state.setTime(42);
      fireEvent.seeked(video);
      expect(onSample).toHaveBeenLastCalledWith(42, 100, 'seeked');
    });

    it('ended followed by detach stays ONE final sample', () => {
      const onSample = vi.fn();
      const { container, unmount } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      installMediaState(video, { currentTime: 100, duration: 100, ended: true, paused: true });
      fireEvent.ended(video);
      expect(onSample).toHaveBeenCalledTimes(1);
      expect(onSample).toHaveBeenLastCalledWith(100, 100, 'ended');

      unmount();
      expect(onSample).toHaveBeenCalledTimes(1);
    });

    it('still reports an ACTIVE user seek/restart to exactly 0', () => {
      const onSample = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 100, paused: true });
      fireEvent.loadedMetadata(video);
      state.setTime(20);
      fireEvent.seeked(video);
      expect(onSample).toHaveBeenLastCalledWith(20, 100, 'seeked');

      state.setTime(0);
      fireEvent.seeked(video);
      expect(onSample).toHaveBeenLastCalledWith(0, 100, 'seeked');
    });

    it('commits the live cursor when a playing AUDIO element detaches (same retirement as video)', () => {
      const onSample = vi.fn();
      const { container, unmount } = render(
        <AudioViewer url="https://example.com/a.mp3" priority onProgressSample={onSample} />,
      );
      const audio = container.querySelector('audio')!;
      const state = installMediaState(audio, { currentTime: 0, duration: 60, paused: false });
      fireEvent.loadedMetadata(audio);
      state.setTime(30);
      fireEvent.timeUpdate(audio);

      unmount();
      expect(onSample).toHaveBeenLastCalledWith(30, 60, 'pause');
    });

    it('emits nothing on detach when playback never started', () => {
      const onSample = vi.fn();
      const { container, unmount } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onProgressSample={onSample} />,
      );
      const video = container.querySelector('video')!;
      installMediaState(video, { currentTime: 0, duration: 100, paused: true });
      fireEvent.loadedMetadata(video);
      unmount();
      expect(onSample).not.toHaveBeenCalled();
    });

    it('emits nothing on detach inside the pre-seed window (autoplay drift must not clobber a saved position)', () => {
      const onSample = vi.fn();
      const { container, unmount } = render(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          autoPlay
          onProgressSample={onSample}
        />,
      );
      const video = container.querySelector('video')!;
      const state = installMediaState(video, { currentTime: 0, duration: 300, paused: false });
      fireEvent.loadedMetadata(video);

      state.setTime(0.7);
      fireEvent.timeUpdate(video);
      unmount();
      expect(onSample).not.toHaveBeenCalled();
    });
  });

  describe('without playback props', () => {
    it('renders and behaves normally with no playback props (video)', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onLoad={onLoad} />,
      );
      const video = container.querySelector('video')!;
      expect(video).not.toBeNull();
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
