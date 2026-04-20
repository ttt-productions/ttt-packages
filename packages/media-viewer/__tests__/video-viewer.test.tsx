import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { VideoViewer } from '../src/video-viewer';

let mockInView = false;
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: () => {}, inView: mockInView }),
}));

// Stub raw IntersectionObserver used for autoPlayOnVisible/autoPlay
class FakeIO {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  constructor(_cb: any, _opts?: any) {}
}

beforeEach(() => {
  mockInView = false;
  vi.stubGlobal('IntersectionObserver', FakeIO);
  // jsdom stubs these as "not implemented" — silence them
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('VideoViewer', () => {
  describe('lazy/priority gating', () => {
    it('does not render <video> when lazy and not in view', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).not.toBeInTheDocument();
    });

    it('renders <video> immediately when priority=true', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('renders <video> immediately when lazy=false', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" lazy={false} unloadOnExit={false} />
      );
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('renders <video> after inView becomes true', () => {
      const { container, rerender } = render(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).not.toBeInTheDocument();

      mockInView = true;
      rerender(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('sets preload="auto" on video when priority=true', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(container.querySelector('video')).toHaveAttribute('preload', 'auto');
    });

    it('passes explicit preload prop through when not priority', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" lazy={false} unloadOnExit={false} preload="none" />
      );
      expect(container.querySelector('video')).toHaveAttribute('preload', 'none');
    });

    it('defaults preload to "metadata"', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" lazy={false} unloadOnExit={false} />
      );
      expect(container.querySelector('video')).toHaveAttribute('preload', 'metadata');
    });
  });

  describe('unloadOnExit', () => {
    it('unmounts <video> when exiting view (unloadOnExit=true is the default)', () => {
      mockInView = true;
      const { container, rerender } = render(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).toBeInTheDocument();

      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" />);
      expect(container.querySelector('video')).not.toBeInTheDocument();
    });

    it('keeps <video> mounted when unloadOnExit=false', () => {
      mockInView = true;
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" unloadOnExit={false} />
      );
      expect(container.querySelector('video')).toBeInTheDocument();

      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" unloadOnExit={false} />);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('does not unmount <video> when priority=true (even with unloadOnExit)', () => {
      mockInView = true;
      const { container, rerender } = render(
        <VideoViewer url="https://example.com/v.mp4" priority />
      );
      expect(container.querySelector('video')).toBeInTheDocument();

      mockInView = false;
      rerender(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(container.querySelector('video')).toBeInTheDocument();
    });
  });

  describe('load/error callbacks', () => {
    it('calls onLoad when video fires loadeddata', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onLoad={onLoad} />
      );
      fireEvent.loadedData(container.querySelector('video')!);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('calls onError when video fires error', () => {
      const onError = vi.fn();
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority onError={onError} />
      );
      fireEvent.error(container.querySelector('video')!);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('renders custom fallback on error', () => {
      const { container, getByTestId } = render(
        <VideoViewer
          url="https://example.com/v.mp4"
          priority
          fallback={<div data-testid="custom-fallback">broken</div>}
        />
      );
      fireEvent.error(container.querySelector('video')!);
      expect(getByTestId('custom-fallback')).toBeInTheDocument();
    });

    it('renders default error UI when error and no fallback', () => {
      const { container, getByText } = render(
        <VideoViewer url="https://example.com/v.mp4" priority />
      );
      fireEvent.error(container.querySelector('video')!);
      expect(getByText('Failed to load video')).toBeInTheDocument();
    });

    it('video starts with opacity 0 and becomes visible after loadeddata', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      const video = container.querySelector('video')!;
      expect(video).toHaveStyle({ opacity: '0' });
      fireEvent.loadedData(video);
      expect(video).toHaveStyle({ opacity: '1' });
    });
  });

  describe('URL change reset', () => {
    it('resets error state when URL changes', () => {
      const { container, queryByText, rerender } = render(
        <VideoViewer url="https://example.com/a.mp4" priority />
      );
      fireEvent.error(container.querySelector('video')!);
      expect(queryByText('Failed to load video')).toBeInTheDocument();

      rerender(<VideoViewer url="https://example.com/b.mp4" priority />);
      expect(queryByText('Failed to load video')).not.toBeInTheDocument();
      expect(container.querySelector('video')).toHaveAttribute('src', 'https://example.com/b.mp4');
    });
  });

  describe('attribute pass-through', () => {
    it('passes controls prop (default true)', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(container.querySelector('video')).toHaveAttribute('controls');
    });

    it('omits controls when controls=false', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority controls={false} />
      );
      expect(container.querySelector('video')).not.toHaveAttribute('controls');
    });

    it('sets autoPlay when autoPlay=true', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay />
      );
      const video = container.querySelector('video')!;
      expect(video).toHaveAttribute('autoplay');
    });

    it('sets muted when autoPlay=true (muted defaults to autoPlay)', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay />
      );
      expect((container.querySelector('video') as HTMLVideoElement).muted).toBe(true);
    });

    it('respects explicit muted=false even when autoPlay=true', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority autoPlay muted={false} />
      );
      expect((container.querySelector('video') as HTMLVideoElement).muted).toBe(false);
    });

    it('passes loop prop', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority loop />
      );
      expect(container.querySelector('video')).toHaveAttribute('loop');
    });

    it('passes posterUrl as poster attribute', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority posterUrl="https://example.com/p.jpg" />
      );
      expect(container.querySelector('video')).toHaveAttribute('poster', 'https://example.com/p.jpg');
    });

    it('always sets playsInline', () => {
      const { container } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video.playsInline).toBe(true);
    });
  });

  describe('fullscreen / wrapper role', () => {
    it('wrapper is a button when enableFullscreen=true (default)', () => {
      const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(getByRole('button')).toBeInTheDocument();
    });

    it('wrapper is not a button when enableFullscreen=false', () => {
      const { queryByRole } = render(
        <VideoViewer url="https://example.com/v.mp4" priority enableFullscreen={false} />
      );
      expect(queryByRole('button')).not.toBeInTheDocument();
    });

    it('Enter key triggers requestFullscreen when available', () => {
      const requestFullscreenMock = vi.fn();
      Object.defineProperty(HTMLVideoElement.prototype, 'requestFullscreen', {
        configurable: true,
        writable: true,
        value: requestFullscreenMock,
      });

      const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      fireEvent.keyDown(getByRole('button'), { key: 'Enter' });
      expect(requestFullscreenMock).toHaveBeenCalledTimes(1);

      delete (HTMLVideoElement.prototype as any).requestFullscreen;
    });

    it('does not throw if no fullscreen API is available', () => {
      delete (HTMLVideoElement.prototype as any).requestFullscreen;
      const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(() => fireEvent.keyDown(getByRole('button'), { key: 'Enter' })).not.toThrow();
    });

    it('non-toggle keys do not trigger fullscreen', () => {
      const requestFullscreenMock = vi.fn();
      Object.defineProperty(HTMLVideoElement.prototype, 'requestFullscreen', {
        configurable: true,
        writable: true,
        value: requestFullscreenMock,
      });

      const { getByRole } = render(<VideoViewer url="https://example.com/v.mp4" priority />);
      fireEvent.keyDown(getByRole('button'), { key: 'a' });
      expect(requestFullscreenMock).not.toHaveBeenCalled();

      delete (HTMLVideoElement.prototype as any).requestFullscreen;
    });
  });

  describe('autoPlay observer', () => {
    it('does not set up an IntersectionObserver when neither autoPlay nor autoPlayOnVisible is set', () => {
      const ctorSpy = vi.fn();
      class CountingIO extends FakeIO {
        constructor(cb: any, opts?: any) {
          super(cb, opts);
          ctorSpy();
        }
      }
      vi.stubGlobal('IntersectionObserver', CountingIO);

      render(<VideoViewer url="https://example.com/v.mp4" priority />);
      expect(ctorSpy).not.toHaveBeenCalled();
    });

    it('sets up IntersectionObserver when autoPlay=true', () => {
      const ctorSpy = vi.fn();
      class CountingIO extends FakeIO {
        constructor(cb: any, opts?: any) {
          super(cb, opts);
          ctorSpy();
        }
      }
      vi.stubGlobal('IntersectionObserver', CountingIO);

      render(<VideoViewer url="https://example.com/v.mp4" priority autoPlay />);
      expect(ctorSpy).toHaveBeenCalledTimes(1);
    });

    it('sets up IntersectionObserver when autoPlayOnVisible=true', () => {
      const ctorSpy = vi.fn();
      class CountingIO extends FakeIO {
        constructor(cb: any, opts?: any) {
          super(cb, opts);
          ctorSpy();
        }
      }
      vi.stubGlobal('IntersectionObserver', CountingIO);

      render(<VideoViewer url="https://example.com/v.mp4" priority autoPlayOnVisible />);
      expect(ctorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling props', () => {
    it('applies className to wrapper', () => {
      const { getByRole } = render(
        <VideoViewer url="https://example.com/v.mp4" priority className="wrap-x" />
      );
      expect(getByRole('button')).toHaveClass('wrap-x');
    });

    it('applies mediaClassName to the video', () => {
      const { container } = render(
        <VideoViewer url="https://example.com/v.mp4" priority mediaClassName="vid-y" />
      );
      expect(container.querySelector('video')).toHaveClass('vid-y');
    });
  });
});
