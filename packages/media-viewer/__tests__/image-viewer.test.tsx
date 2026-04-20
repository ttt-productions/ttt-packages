import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageViewer } from '../src/image-viewer';

let mockInView = false;
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: () => {}, inView: mockInView }),
}));

beforeEach(() => {
  mockInView = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ImageViewer', () => {
  describe('lazy/priority gating', () => {
    it('does not render <img> when lazy and not in view', () => {
      const { container } = render(<ImageViewer url="https://example.com/a.jpg" />);
      expect(container.querySelector('img')).not.toBeInTheDocument();
    });

    it('renders <img> immediately when priority=true', () => {
      const { container } = render(<ImageViewer url="https://example.com/a.jpg" priority />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('renders <img> immediately when lazy=false', () => {
      const { container } = render(<ImageViewer url="https://example.com/a.jpg" lazy={false} />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('renders <img> after inView becomes true', () => {
      const { container, rerender } = render(<ImageViewer url="https://example.com/a.jpg" />);
      expect(container.querySelector('img')).not.toBeInTheDocument();

      mockInView = true;
      rerender(<ImageViewer url="https://example.com/a.jpg" />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('sets loading="eager" on img when priority=true', () => {
      const { container } = render(<ImageViewer url="https://example.com/a.jpg" priority />);
      expect(container.querySelector('img')).toHaveAttribute('loading', 'eager');
    });

    it('sets loading="lazy" on img when priority=false', () => {
      const { container } = render(<ImageViewer url="https://example.com/a.jpg" lazy={false} />);
      expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy');
    });
  });

  describe('unloadOnExit', () => {
    it('keeps img mounted after exiting view when unloadOnExit=false (default)', () => {
      mockInView = true;
      const { container, rerender } = render(<ImageViewer url="https://example.com/a.jpg" />);
      expect(container.querySelector('img')).toBeInTheDocument();

      mockInView = false;
      rerender(<ImageViewer url="https://example.com/a.jpg" />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('unmounts img when exiting view and unloadOnExit=true', () => {
      mockInView = true;
      const { container, rerender } = render(<ImageViewer url="https://example.com/a.jpg" unloadOnExit />);
      expect(container.querySelector('img')).toBeInTheDocument();

      mockInView = false;
      rerender(<ImageViewer url="https://example.com/a.jpg" unloadOnExit />);
      expect(container.querySelector('img')).not.toBeInTheDocument();
    });

    it('does not unmount img when unloadOnExit=true but priority=true', () => {
      mockInView = true;
      const { container, rerender } = render(
        <ImageViewer url="https://example.com/a.jpg" unloadOnExit priority />
      );
      expect(container.querySelector('img')).toBeInTheDocument();

      mockInView = false;
      rerender(<ImageViewer url="https://example.com/a.jpg" unloadOnExit priority />);
      expect(container.querySelector('img')).toBeInTheDocument();
    });
  });

  describe('load/error callbacks', () => {
    it('calls onLoad when img fires load event', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <ImageViewer url="https://example.com/a.jpg" priority onLoad={onLoad} />
      );
      fireEvent.load(container.querySelector('img')!);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('calls onError when img fires error event', () => {
      const onError = vi.fn();
      const { container } = render(
        <ImageViewer url="https://example.com/a.jpg" priority onError={onError} />
      );
      fireEvent.error(container.querySelector('img')!);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('renders custom fallback on error', () => {
      const { container } = render(
        <ImageViewer
          url="https://example.com/a.jpg"
          priority
          fallback={<div data-testid="custom-fallback">broken</div>}
        />
      );
      fireEvent.error(container.querySelector('img')!);
      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    });

    it('renders nothing when error and no fallback provided', () => {
      const { container } = render(<ImageViewer url="https://example.com/a.jpg" priority />);
      fireEvent.error(container.querySelector('img')!);
      expect(container).toBeEmptyDOMElement();
    });

    it('img starts with opacity 0 and becomes visible after load', () => {
      const { container } = render(<ImageViewer url="https://example.com/a.jpg" priority />);
      const img = container.querySelector('img')!;
      expect(img).toHaveStyle({ opacity: '0' });
      fireEvent.load(img);
      expect(img).toHaveStyle({ opacity: '1' });
    });
  });

  describe('URL change reset', () => {
    it('resets error state when URL changes', () => {
      const { container, rerender } = render(
        <ImageViewer url="https://example.com/a.jpg" priority fallback={<div data-testid="fb">fb</div>} />
      );
      fireEvent.error(container.querySelector('img')!);
      expect(screen.getByTestId('fb')).toBeInTheDocument();

      rerender(
        <ImageViewer url="https://example.com/b.jpg" priority fallback={<div data-testid="fb">fb</div>} />
      );
      expect(screen.queryByTestId('fb')).not.toBeInTheDocument();
      expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/b.jpg');
    });
  });

  describe('zoom', () => {
    it('wrapper is a button when enableZoom=true (default)', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('wrapper is not a button when enableZoom=false', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority enableZoom={false} />);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('aria-pressed toggles on click', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority />);
      const wrapper = screen.getByRole('button');
      expect(wrapper).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(wrapper);
      expect(wrapper).toHaveAttribute('aria-pressed', 'true');
    });

    it('Enter key toggles zoom', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority />);
      const wrapper = screen.getByRole('button');
      fireEvent.keyDown(wrapper, { key: 'Enter' });
      expect(wrapper).toHaveAttribute('aria-pressed', 'true');
    });

    it('Space key toggles zoom', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority />);
      const wrapper = screen.getByRole('button');
      fireEvent.keyDown(wrapper, { key: ' ' });
      expect(wrapper).toHaveAttribute('aria-pressed', 'true');
    });

    it('other keys do not toggle zoom', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority />);
      const wrapper = screen.getByRole('button');
      fireEvent.keyDown(wrapper, { key: 'a' });
      expect(wrapper).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not toggle when enableZoom=false', () => {
      const { container } = render(
        <ImageViewer url="https://example.com/a.jpg" priority enableZoom={false} />
      );
      const img = container.querySelector('img')!;
      const wrapper = img.parentElement!;
      fireEvent.click(wrapper);
      expect(img).toBeInTheDocument();
    });
  });

  describe('styling props', () => {
    it('applies className to wrapper', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority className="wrap-x" />);
      expect(screen.getByRole('button')).toHaveClass('wrap-x');
    });

    it('applies mediaClassName to the img', () => {
      const { container } = render(
        <ImageViewer url="https://example.com/a.jpg" priority mediaClassName="img-y" />
      );
      expect(container.querySelector('img')).toHaveClass('img-y');
    });

    it('applies circular wrapper style when isCircular=true', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority isCircular />);
      expect(screen.getByRole('button')).toHaveStyle({ borderRadius: '50%', overflow: 'hidden' });
    });

    it('uses alt prop on img', () => {
      render(<ImageViewer url="https://example.com/a.jpg" priority alt="a picture" />);
      expect(screen.getByAltText('a picture')).toBeInTheDocument();
    });

    it('defaults alt to empty string when not provided', () => {
      const { container } = render(<ImageViewer url="https://example.com/a.jpg" priority />);
      expect(container.querySelector('img')).toHaveAttribute('alt', '');
    });
  });
});
