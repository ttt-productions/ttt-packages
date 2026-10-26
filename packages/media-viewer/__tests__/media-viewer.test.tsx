import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MediaPreview } from '../src/react/media-viewer.js';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';

// jsdom has no URL.createObjectURL, and React may flush a prior test's deferred cleanups inside
// the next test's act(), so these stubs stay installed for the whole module.
const createObjectURLMock = vi.fn<typeof URL.createObjectURL>(() => 'blob:fake-url');
const revokeObjectURLMock = vi.fn<typeof URL.revokeObjectURL>();
URL.createObjectURL = createObjectURLMock;
URL.revokeObjectURL = revokeObjectURLMock;

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  createObjectURLMock.mockReset();
  createObjectURLMock.mockImplementation(() => 'blob:fake-url');
  revokeObjectURLMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MediaPreview', () => {
  describe('empty / null url', () => {
    it('renders EmptyFallback when url is null', () => {
      const { container } = render(<MediaPreview url={null} />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('.mv-empty-fallback')).toBeInTheDocument();
    });

    it('renders the pending state (a labeled spinner), never the empty fallback, while urlPending', () => {
      const { container, getByRole } = render(<MediaPreview url={null} urlPending />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('.mv-pending-fallback')).toBeInTheDocument();
      expect(container.querySelector('.mv-empty-fallback')).toBeNull();
      expect(getByRole('status')).toHaveTextContent('Loading media');
    });

    it('renders avatar-shaped empty fallback when isCircular and url is null', () => {
      const { container } = render(<MediaPreview url={null} isCircular />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('.mv-avatar-fallback')).toBeInTheDocument();
      expect(container.querySelector('.mv-avatar-fallback')?.textContent).toBe('?');
    });
  });

  describe('inferType: explicit type prop wins', () => {
    it('renders ImageViewer when type="image"', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="image" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('renders VideoViewer when type="video"', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="video" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('forwards enableZoom={false} to the image viewer — no zoom affordance renders', () => {
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="image" enableZoom={false} />,
      );
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('img')).toBeInTheDocument();
      expect(container.querySelector('[role="button"]')).not.toBeInTheDocument();
      expect(container.querySelector('[aria-label="Zoom in image"]')).not.toBeInTheDocument();
    });

    it('keeps the ImageViewer zoom default (ON) when enableZoom is not passed', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="image" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('[aria-label="Zoom in image"]')).toBeInTheDocument();
    });

    it('renders the canonical audio player when type="audio"', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="audio" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('audio')).toBeInTheDocument();
      expect(container.querySelector('audio')).not.toHaveAttribute('controls');
      expect(container.querySelector('[data-mv-player]')).toBeInTheDocument();
    });

    it('renders fallback link when type="other"', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="other" />);
      mockAllIsIntersecting(0.01);
      const link = container.querySelector('a');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com/x');
    });

    it('accepts MIME-form type and takes the primary segment: "image/png" -> image', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="image/png" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('accepts MIME-form type "video/mp4" -> video', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="video/mp4" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('accepts MIME-form type "audio/mpeg" -> audio', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="audio/mpeg" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('audio')).toBeInTheDocument();
    });
  });

  describe('inferType: fallback to mime / name / url hints', () => {
    it('routes by explicit mime', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" mime="image/jpeg" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('routes by filename extension via `name`', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" name="song.mp3" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('audio')).toBeInTheDocument();
    });

    it('routes video by filename extension via `name`', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" name="clip.mp4" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('video')).toBeInTheDocument();
    });

    it('routes image by filename extension via `name`', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" name="picture.png" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('unknown extension -> fallback link', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" name="data.xyz" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('a')).toBeInTheDocument();
    });
  });

  describe('fallback link / fallbackMode', () => {
    it('fallback link uses filename as download attribute', () => {
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="other" filename="report.pdf" />,
      );
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('a')).toHaveAttribute('download', 'report.pdf');
    });

    it('fallback link uses fallbackLabel', () => {
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="other" fallbackLabel="Open file" />,
      );
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('a')?.textContent).toBe('Open file');
    });

    it('fallback link uses default label "Download" when no fallbackLabel', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="other" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('a')?.textContent).toBe('Download');
    });

    it('returns null when fallbackMode="none" and type is other', () => {
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="other" fallbackMode="none" />,
      );
      mockAllIsIntersecting(0.01);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Blob / File url', () => {
    it('calls URL.createObjectURL for a Blob url and uses the resulting object URL', () => {
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-object-url');

      const blob = new Blob(['fake'], { type: 'image/png' });
      const { container } = render(<MediaPreview url={blob} type="image" />);
      mockAllIsIntersecting(0.01);

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(container.querySelector('img')).toHaveAttribute('src', 'blob:mock-object-url');
    });

    it('revokes object URL on unmount / url change', () => {
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-object-url');

      const blob = new Blob(['fake'], { type: 'image/png' });
      const { unmount } = render(<MediaPreview url={blob} type="image" />);
      mockAllIsIntersecting(0.01);
      unmount();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-object-url');
    });
  });

  describe('error propagation', () => {
    it('child onError triggers parent ErrorFallback', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="image" />);
      mockAllIsIntersecting(0.01);
      const img = container.querySelector('img')!;
      fireEvent.error(img);
      expect(container.querySelector('.mv-error-fallback')).toBeInTheDocument();
    });

    it('onError callback from props is called', () => {
      const onError = vi.fn();
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="image" onError={onError} />,
      );
      mockAllIsIntersecting(0.01);
      fireEvent.error(container.querySelector('img')!);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('video child error also bubbles to parent ErrorFallback', () => {
      const { container } = render(<MediaPreview url="https://example.com/x" type="video" />);
      mockAllIsIntersecting(0.01);
      fireEvent.error(container.querySelector('video')!);
      expect(container.querySelector('.mv-error-fallback')).toBeInTheDocument();
    });

    it('resets hasError when url prop changes to a new URL', () => {
      const { container, rerender } = render(
        <MediaPreview url="https://example.com/a" type="image" />,
      );
      mockAllIsIntersecting(0.01);
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('.mv-error-fallback')).toBeInTheDocument();

      rerender(<MediaPreview url="https://example.com/b" type="image" />);
      mockAllIsIntersecting(0.01);
      expect(container.querySelector('.mv-error-fallback')).not.toBeInTheDocument();
      expect(container.querySelector('img')).toBeInTheDocument();
    });
  });

  describe('styling pass-through', () => {
    it('applies className to outer wrapper', () => {
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="image" className="outer-x" />,
      );
      mockAllIsIntersecting(0.01);
      expect(container.firstChild).toHaveClass('outer-x');
    });

    it('applies circular style when isCircular=true', () => {
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="image" isCircular />,
      );
      mockAllIsIntersecting(0.01);
      expect(container.firstChild).toHaveStyle({ borderRadius: '50%', overflow: 'hidden' });
    });
  });

  describe('onLoad forwarding', () => {
    it('image onLoad forwards to parent onLoad', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="image" onLoad={onLoad} />,
      );
      mockAllIsIntersecting(0.01);
      fireEvent.load(container.querySelector('img')!);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('video onLoad (via loadeddata) forwards to parent onLoad', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <MediaPreview url="https://example.com/x" type="video" onLoad={onLoad} />,
      );
      mockAllIsIntersecting(0.01);
      fireEvent.loadedData(container.querySelector('video')!);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });
  });

  describe('playback API pass-through', () => {
    it('forwards onEnded to the video child', () => {
      const onEnded = vi.fn();
      const { container } = render(
        <MediaPreview url="https://example.com/v.mp4" type="video" priority onEnded={onEnded} />,
      );
      mockAllIsIntersecting(0.01);
      fireEvent.ended(container.querySelector('video')!);
      expect(onEnded).toHaveBeenCalledTimes(1);
    });

    it('forwards endOverlay to the audio child', () => {
      const { container, queryByTestId } = render(
        <MediaPreview
          url="https://example.com/a.mp3"
          type="audio"
          priority
          endOverlay={<div data-testid="mp-end">done</div>}
        />,
      );
      mockAllIsIntersecting(0.01);
      const audio = container.querySelector('audio')!;
      Object.defineProperty(audio, 'currentTime', { configurable: true, value: 10 });
      Object.defineProperty(audio, 'duration', { configurable: true, value: 10 });
      fireEvent.ended(audio);
      expect(queryByTestId('mp-end')).toBeInTheDocument();
    });
  });
});
