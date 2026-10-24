import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { VideoViewer } from '../src/react/video-viewer.js';

let mockInView = false;
let mockRatio = 0;

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: () => {},
    inView: mockInView,
    entry: { intersectionRatio: mockRatio } as unknown as IntersectionObserverEntry,
  }),
}));

let playSpy: ReturnType<typeof vi.spyOn>;
let pauseSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockInView = false;
  mockRatio = 0;
  // jsdom stubs these as "not implemented".
  playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  // jsdom does not define requestFullscreen.
  if (!('requestFullscreen' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: () => Promise.resolve(),
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
});

describe('VideoViewer', () => {
  describe('lazy/priority gating', () => {
    it('does not render <video> when lazy and not in view', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).toBeNull();
    });

    it('renders <video> immediately when priority=true', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('renders <video> immediately when lazy=false', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" lazy={false} />);
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('renders <video> after inView becomes true', () => {
      mockInView = true;
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('sets preload="auto" on video when priority=true', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(container.querySelector('video')?.getAttribute('preload')).toBe('auto');
    });

    it('passes explicit preload prop through when not priority', () => {
      mockInView = true;
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" preload="auto" />);
      expect(container.querySelector('video')?.getAttribute('preload')).toBe('auto');
    });

    it('defaults preload to "metadata"', () => {
      mockInView = true;
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')?.getAttribute('preload')).toBe('metadata');
    });
  });

  describe('unloadOnExit', () => {
    it('unmounts <video> when exiting view (unloadOnExit=true is the default)', () => {
      mockInView = true;
      const { container, rerender } = render(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).not.toBeNull();
      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).toBeNull();
    });

    it('keeps <video> mounted when unloadOnExit=false', () => {
      mockInView = true;
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" unloadOnExit={false} />,
      );
      expect(container.querySelector('video')).not.toBeNull();
      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" unloadOnExit={false} />);
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('does not unmount <video> when priority=true (even with unloadOnExit)', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority />,
      );
      expect(container.querySelector('video')).not.toBeNull();
      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(container.querySelector('video')).not.toBeNull();
    });

    it('does not unmount <video> when lazy=false (no viewport gating at all)', () => {
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" lazy={false} />,
      );
      expect(container.querySelector('video')).not.toBeNull();
      rerender(<VideoViewer url="https://example.com/v.mp4" lazy={false} />);
      expect(container.querySelector('video')).not.toBeNull();
    });
  });

  describe('load/error callbacks', () => {
    it('calls onLoad when video fires loadeddata', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onLoad={onLoad} />,
      );
      const video = container.querySelector('video')!;
      fireEvent.loadedData(video);
      expect(onLoad).toHaveBeenCalled();
    });

    it('calls onError when video fires error', () => {
      const onError = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onError={onError} />,
      );
      const video = container.querySelector('video')!;
      fireEvent.error(video);
      expect(onError).toHaveBeenCalled();
    });

    it('renders custom fallback on error', () => {
      const { container, getByText } = render(
        <VideoViewer url="https://example.com/v.mp4" priority fallback={<div>custom-fb</div>} />,
      );
      const video = container.querySelector('video')!;
      fireEvent.error(video);
      expect(getByText('custom-fb')).toBeInTheDocument();
    });

    it('renders default error UI when error and no fallback', () => {
      const { container, getByText } = render(
        <VideoViewer url="https://example.com/v.mp4" priority />,
      );
      const video = container.querySelector('video')!;
      fireEvent.error(video);
      expect(getByText('Failed to load video')).toBeInTheDocument();
    });

    it('video starts with opacity 0 and becomes visible after loadeddata', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video.style.opacity).toBe('0');
      fireEvent.loadedData(video);
      expect(video.style.opacity).toBe('1');
    });
  });

  describe('URL change reset', () => {
    it('resets error state when URL changes', () => {
      const { container, rerender, queryByText } = render(
        <VideoViewer url="https://example.com/a.mp4" priority />,
      );
      const video = container.querySelector('video')!;
      fireEvent.error(video);
      expect(queryByText('Failed to load video')).toBeInTheDocument();
      rerender(<VideoViewer url="https://example.com/b.mp4" priority />);
      expect(queryByText('Failed to load video')).not.toBeInTheDocument();
    });
  });

  describe('attribute pass-through', () => {
    it('passes controls prop (default true)', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(container.querySelector('video')?.hasAttribute('controls')).toBe(true);
    });

    it('omits controls when controls=false', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority controls={false} />,
      );
      expect(container.querySelector('video')?.hasAttribute('controls')).toBe(false);
    });

    it('sets autoPlay when autoPlay=true', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay />,
      );
      expect(container.querySelector('video')?.hasAttribute('autoplay')).toBe(true);
    });

    it('sets muted when autoPlay=true (muted defaults to autoPlay)', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay />,
      );
      expect((container.querySelector('video') as HTMLVideoElement).muted).toBe(true);
    });

    it('respects explicit muted=false even when autoPlay=true', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay muted={false} />,
      );
      expect((container.querySelector('video') as HTMLVideoElement).muted).toBe(false);
    });

    it('passes loop prop', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority loop />);
      expect(container.querySelector('video')?.hasAttribute('loop')).toBe(true);
    });

    it('passes posterUrl as poster attribute', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority posterUrl="p.jpg" />,
      );
      expect(container.querySelector('video')?.getAttribute('poster')).toBe('p.jpg');
    });

    it('always sets playsInline', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect((container.querySelector('video') as HTMLVideoElement).playsInline).toBe(true);
    });
  });

  describe('fullscreen / wrapper role', () => {
    it('wrapper is a button when enableFullscreen=true (default)', () => {
      const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(getByRole('button')).toBeInTheDocument();
    });

    it('wrapper is not a button when enableFullscreen=false', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority enableFullscreen={false} />,
      );
      expect(container.querySelector('[role="button"]')).toBeNull();
    });

    it('Enter key triggers requestFullscreen when available', () => {
      const fsSpy = vi.fn();
      vi.spyOn(HTMLElement.prototype, 'requestFullscreen').mockImplementation(function (
        this: HTMLElement,
      ) {
        fsSpy();
        return Promise.resolve();
      });
      const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      fireEvent.keyDown(getByRole('button'), { key: 'Enter' });
      expect(fsSpy).toHaveBeenCalled();
    });

    it('does not throw if no fullscreen API is available', () => {
      const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(() => fireEvent.keyDown(getByRole('button'), { key: 'Enter' })).not.toThrow();
    });

    it('a refusal from a prefixed fullscreen method that throws does nothing', async () => {
      Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
      const webkit = vi.fn(() => {
        throw new Error('fullscreen refused');
      });
      Object.defineProperty(HTMLElement.prototype, 'webkitRequestFullscreen', {
        configurable: true,
        value: webkit,
      });
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      try {
        const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
        expect(() => fireEvent.keyDown(getByRole('button'), { key: 'Enter' })).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(webkit).toHaveBeenCalled();
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
        Reflect.deleteProperty(HTMLElement.prototype, 'webkitRequestFullscreen');
      }
    });

    it('a refusal from the standard fullscreen request, whose promise rejects, does nothing', async () => {
      // A vi.fn() handles the promise it returns to record how it settled, so a plain function stands in.
      let requested = 0;
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        configurable: true,
        writable: true,
        value: () => {
          requested += 1;
          return Promise.reject(new TypeError('fullscreen refused'));
        },
      });
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      try {
        const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
        expect(() => fireEvent.keyDown(getByRole('button'), { key: 'Enter' })).not.toThrow();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(requested).toBe(1);
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
      }
    });

    it('non-toggle keys do not trigger fullscreen', () => {
      const fsSpy = vi.fn();
      vi.spyOn(HTMLElement.prototype, 'requestFullscreen').mockImplementation(function (
        this: HTMLElement,
      ) {
        fsSpy();
        return Promise.resolve();
      });
      const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      fireEvent.keyDown(getByRole('button'), { key: 'a' });
      expect(fsSpy).not.toHaveBeenCalled();
    });
  });

  describe('unified observer / autoplay-on-visible', () => {
    it('does not call play when neither autoPlay nor autoPlayOnVisible is set, even if ratio >= 0.5', async () => {
      mockInView = true;
      mockRatio = 0.9;
      render(<VideoViewer url="https://example.com/v.mp4" priority />);
      await Promise.resolve();
      expect(playSpy).not.toHaveBeenCalled();
    });

    it('calls video.play() when autoPlayOnVisible and ratio >= 0.5', async () => {
      mockInView = true;
      mockRatio = 0.6;
      render(<VideoViewer url="https://example.com/v.mp4" priority autoPlayOnVisible />);
      await Promise.resolve();
      expect(playSpy).toHaveBeenCalled();
    });

    it('calls video.play() when autoPlay and ratio >= 0.5', async () => {
      mockInView = true;
      mockRatio = 0.5;
      render(<VideoViewer url="https://example.com/v.mp4" priority autoPlay />);
      await Promise.resolve();
      expect(playSpy).toHaveBeenCalled();
    });

    it('does not call play when ratio < 0.5 even with autoPlayOnVisible', async () => {
      mockInView = true;
      mockRatio = 0.3;
      render(<VideoViewer url="https://example.com/v.mp4" priority autoPlayOnVisible />);
      await Promise.resolve();
      expect(playSpy).not.toHaveBeenCalled();
    });

    it('calls pause when ratio drops below 0.5 after being above', async () => {
      mockInView = true;
      mockRatio = 0.8;
      const { rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlayOnVisible />,
      );
      await Promise.resolve();
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
        configurable: true,
        get: () => false,
      });
      mockRatio = 0.2;
      rerender(<VideoViewer url="https://example.com/v.mp4" priority autoPlayOnVisible />);
      await Promise.resolve();
      expect(pauseSpy).toHaveBeenCalled();
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
        configurable: true,
        get: () => true,
      });
    });

    it('does not play before shouldLoad becomes true (lazy + autoplay path)', async () => {
      mockInView = false;
      mockRatio = 0.6;
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" autoPlayOnVisible />,
      );
      await Promise.resolve();
      expect(container.querySelector('video')).toBeNull();
      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe('styling props', () => {
    it('applies className to wrapper', () => {
      const { getByRole } = render(
        <VideoViewer url="https://example.com/v.mp4" priority className="wrap-x" />,
      );
      expect(getByRole('button')).toHaveClass('wrap-x');
    });

    it('applies mediaClassName to the video', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority mediaClassName="vid-y" />,
      );
      expect(container.querySelector('video')).toHaveClass('vid-y');
    });
  });
});
