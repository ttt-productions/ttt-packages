import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MediaViewer, MediaPreview } from '../src/media-viewer';

// Force children to render immediately (priority path) so we don't have to mock inView for them individually
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: () => {}, inView: true }),
}));

class FakeIO {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  constructor(_cb: any, _opts?: any) {}
}

// Stub URL.createObjectURL / revokeObjectURL at MODULE scope (never deleted).
// jsdom doesn't implement these, and React 18 may flush deferred effect cleanups
// from prior tests inside the next test's act(), so we need these to always exist.
const createObjectURLMock = vi.fn(() => 'blob:fake-url');
const revokeObjectURLMock = vi.fn();
(URL as any).createObjectURL = createObjectURLMock;
(URL as any).revokeObjectURL = revokeObjectURLMock;

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  // Reset call counts / any per-test overrides but keep the mocks installed
  createObjectURLMock.mockReset();
  createObjectURLMock.mockImplementation(() => 'blob:fake-url');
  revokeObjectURLMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // DO NOT delete URL.createObjectURL / URL.revokeObjectURL — deferred cleanups from this
  // test may still fire during the NEXT test's act() and would throw without them.
});

describe('MediaViewer', () => {
  describe('empty / null url', () => {
    it('renders EmptyFallback when url is null', () => {
      const { container } = render(<MediaViewer url={null as any} />);
      expect(container.querySelector('.mv-empty-fallback')).toBeInTheDocument();
    });

    it('renders avatar-shaped empty fallback when isCircular and url is null', () => {
      const { container } = render(<MediaViewer url={null as any} isCircular />);
      expect(container.querySelector('.mv-avatar-fallback')).toBeInTheDocument();
      expect(container.querySelector('.mv-avatar-fallback')?.textContent).toBe('?');
    });
  });

  describe('inferType: explicit type prop wins', () => {
    it('renders ImageViewer when type="image"', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type="image" />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('renders VideoViewer when type="video"', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type="video" />);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('renders AudioViewer when type="audio"', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type="audio" />);
      expect(container.querySelector('audio')).toBeInTheDocument();
    });

    it('renders fallback link when type="other"', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type="other" />);
      const link = container.querySelector('a');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com/x');
    });

    it('accepts MIME-form type and takes the primary segment: "image/png" -> image', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type={'image/png' as any} />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('accepts MIME-form type "video/mp4" -> video', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type={'video/mp4' as any} />);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('accepts MIME-form type "audio/mpeg" -> audio', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type={'audio/mpeg' as any} />);
      expect(container.querySelector('audio')).toBeInTheDocument();
    });
  });

  describe('inferType: fallback to mime / name / url hints', () => {
    it('routes by explicit mime', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" mime="image/jpeg" />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('routes by filename extension via `name`', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" name="song.mp3" />);
      expect(container.querySelector('audio')).toBeInTheDocument();
    });

    it('routes video by filename extension via `name`', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" name="clip.mp4" />);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('routes image by filename extension via `name`', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" name="picture.png" />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('unknown extension -> fallback link', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" name="data.xyz" />);
      expect(container.querySelector('a')).toBeInTheDocument();
    });
  });

  describe('fallback link / fallbackMode', () => {
    it('fallback link uses filename as download attribute', () => {
      const { container } = render(
        <MediaViewer url="https://example.com/x" type="other" filename="report.pdf" />
      );
      expect(container.querySelector('a')).toHaveAttribute('download', 'report.pdf');
    });

    it('fallback link uses fallbackLabel', () => {
      const { container } = render(
        <MediaViewer url="https://example.com/x" type="other" fallbackLabel="Open file" />
      );
      expect(container.querySelector('a')?.textContent).toBe('Open file');
    });

    it('fallback link uses default label "Download" when no fallbackLabel', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type="other" />);
      expect(container.querySelector('a')?.textContent).toBe('Download');
    });

    it('returns null when fallbackMode="none" and type is other', () => {
      const { container } = render(
        <MediaViewer url="https://example.com/x" type="other" fallbackMode="none" />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Blob / File url', () => {
    it('calls URL.createObjectURL for a Blob url and uses the resulting object URL', () => {
      // Override the beforeEach noop with a specific return value
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-object-url');

      const blob = new Blob(['fake'], { type: 'image/png' });
      const { container } = render(<MediaViewer url={blob} type="image" />);

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(container.querySelector('img')).toHaveAttribute('src', 'blob:mock-object-url');
    });

    it('revokes object URL on unmount / url change', () => {
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-object-url');

      const blob = new Blob(['fake'], { type: 'image/png' });
      const { unmount } = render(<MediaViewer url={blob} type="image" />);
      unmount();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-object-url');
    });
  });

  describe('error propagation', () => {
    it('child onError triggers parent ErrorFallback', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type="image" />);
      const img = container.querySelector('img')!;
      fireEvent.error(img);
      expect(container.querySelector('.mv-error-fallback')).toBeInTheDocument();
    });

    it('onError callback from props is called', () => {
      const onError = vi.fn();
      const { container } = render(
        <MediaViewer url="https://example.com/x" type="image" onError={onError} />
      );
      fireEvent.error(container.querySelector('img')!);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('video child error also bubbles to parent ErrorFallback', () => {
      const { container } = render(<MediaViewer url="https://example.com/x" type="video" />);
      fireEvent.error(container.querySelector('video')!);
      expect(container.querySelector('.mv-error-fallback')).toBeInTheDocument();
    });

    it('resets hasError when url prop changes to a new URL', () => {
      const { container, rerender } = render(
        <MediaViewer url="https://example.com/a" type="image" />
      );
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('.mv-error-fallback')).toBeInTheDocument();

      rerender(<MediaViewer url="https://example.com/b" type="image" />);
      expect(container.querySelector('.mv-error-fallback')).not.toBeInTheDocument();
      expect(container.querySelector('img')).toBeInTheDocument();
    });
  });

  describe('styling pass-through', () => {
    it('applies className to outer wrapper', () => {
      const { container } = render(
        <MediaViewer url="https://example.com/x" type="image" className="outer-x" />
      );
      expect(container.firstChild).toHaveClass('outer-x');
    });

    it('applies circular style when isCircular=true', () => {
      const { container } = render(
        <MediaViewer url="https://example.com/x" type="image" isCircular />
      );
      expect(container.firstChild).toHaveStyle({ borderRadius: '50%', overflow: 'hidden' });
    });
  });

  describe('onLoad forwarding', () => {
    it('image onLoad forwards to parent onLoad', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <MediaViewer url="https://example.com/x" type="image" onLoad={onLoad} />
      );
      fireEvent.load(container.querySelector('img')!);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('video onLoad (via loadeddata) forwards to parent onLoad', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <MediaViewer url="https://example.com/x" type="video" onLoad={onLoad} />
      );
      fireEvent.loadedData(container.querySelector('video')!);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });
  });

  describe('MediaPreview alias', () => {
    it('is the same component as MediaViewer', () => {
      expect(MediaPreview).toBe(MediaViewer);
    });

    it('works as a drop-in for rendering', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="image" />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });
  });
});
