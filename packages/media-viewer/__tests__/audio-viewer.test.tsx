import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { AudioViewer } from '../src/audio-viewer';

let mockInView = false;
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: () => {}, inView: mockInView }),
}));

beforeEach(() => {
  mockInView = false;
  vi.useFakeTimers();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AudioViewer', () => {
  describe('lazy/priority gating', () => {
    it('does not render <audio> initially when lazy and not in view (before delayed-load timer)', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" />);
      expect(container.querySelector('audio')).not.toBeInTheDocument();
    });

    it('renders <audio> immediately when priority=true', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" priority />);
      expect(container.querySelector('audio')).toBeInTheDocument();
    });

    it('renders <audio> immediately when lazy=false', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" lazy={false} />);
      expect(container.querySelector('audio')).toBeInTheDocument();
    });

    it('renders <audio> after inView becomes true', () => {
      const { container, rerender } = render(<AudioViewer url="https://example.com/a.mp3" />);
      expect(container.querySelector('audio')).not.toBeInTheDocument();

      mockInView = true;
      rerender(<AudioViewer url="https://example.com/a.mp3" />);
      expect(container.querySelector('audio')).toBeInTheDocument();
    });

    it('renders <audio> after the 100ms delayed-load timer fires (accordion-compatibility path)', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" />);
      expect(container.querySelector('audio')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(container.querySelector('audio')).toBeInTheDocument();
    });

    it('shows a full skeleton (not the absolute-positioned one) while not yet loaded', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" />);
      const skeleton = container.querySelector('[data-ai-hint]');
      expect(skeleton).toBeInTheDocument();
    });

    it('does not render skeleton when skeleton=false and not yet loaded', () => {
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" skeleton={false} />
      );
      expect(container.querySelector('[data-ai-hint]')).not.toBeInTheDocument();
    });
  });

  describe('load/error callbacks', () => {
    it('calls onLoad when audio fires loadeddata', () => {
      const onLoad = vi.fn();
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority onLoad={onLoad} />
      );
      fireEvent.loadedData(container.querySelector('audio')!);
      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('handleCanPlay also marks loaded (no onLoad call, just state)', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" priority />);
      const audio = container.querySelector('audio')!;
      expect(audio).toHaveStyle({ opacity: '0' });
      fireEvent.canPlay(audio);
      expect(audio).toHaveStyle({ opacity: '1' });
    });

    it('calls onError when audio fires error', () => {
      const onError = vi.fn();
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority onError={onError} />
      );
      fireEvent.error(container.querySelector('audio')!);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('renders custom fallback on error', () => {
      const { container, getByTestId } = render(
        <AudioViewer
          url="https://example.com/a.mp3"
          priority
          fallback={<div data-testid="custom-fallback">broken</div>}
        />
      );
      fireEvent.error(container.querySelector('audio')!);
      expect(getByTestId('custom-fallback')).toBeInTheDocument();
    });

    it('renders default error UI when error and no fallback', () => {
      const { container, getByText } = render(
        <AudioViewer url="https://example.com/a.mp3" priority />
      );
      fireEvent.error(container.querySelector('audio')!);
      expect(getByText('Failed to load audio')).toBeInTheDocument();
    });

    it('audio starts with opacity 0 and becomes visible after loadeddata', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" priority />);
      const audio = container.querySelector('audio')!;
      expect(audio).toHaveStyle({ opacity: '0' });
      fireEvent.loadedData(audio);
      expect(audio).toHaveStyle({ opacity: '1' });
    });
  });

  describe('onLoadChange reporting', () => {
    it('calls onLoadChange(true) initially (still loading)', () => {
      const onLoadChange = vi.fn();
      render(<AudioViewer url="https://example.com/a.mp3" priority onLoadChange={onLoadChange} />);
      expect(onLoadChange).toHaveBeenCalledWith(true);
    });

    it('calls onLoadChange(false) after loadeddata', () => {
      const onLoadChange = vi.fn();
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority onLoadChange={onLoadChange} />
      );
      fireEvent.loadedData(container.querySelector('audio')!);
      expect(onLoadChange).toHaveBeenLastCalledWith(false);
    });
  });

  describe('URL change reset', () => {
    it('resets error state when URL changes', () => {
      const { container, queryByText, rerender } = render(
        <AudioViewer url="https://example.com/a.mp3" priority />
      );
      fireEvent.error(container.querySelector('audio')!);
      expect(queryByText('Failed to load audio')).toBeInTheDocument();

      rerender(<AudioViewer url="https://example.com/b.mp3" priority />);
      expect(queryByText('Failed to load audio')).not.toBeInTheDocument();
      expect(container.querySelector('audio')).toHaveAttribute('src', 'https://example.com/b.mp3');
    });
  });

  describe('attribute pass-through', () => {
    it('passes controls prop (default true)', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" priority />);
      expect(container.querySelector('audio')).toHaveAttribute('controls');
    });

    it('omits controls when controls=false', () => {
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority controls={false} />
      );
      expect(container.querySelector('audio')).not.toHaveAttribute('controls');
    });

    it('passes autoPlay prop', () => {
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority autoPlay />
      );
      expect(container.querySelector('audio')).toHaveAttribute('autoplay');
    });

    it('passes loop prop', () => {
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority loop />
      );
      expect(container.querySelector('audio')).toHaveAttribute('loop');
    });

    it('passes explicit preload prop through', () => {
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority preload="none" />
      );
      expect(container.querySelector('audio')).toHaveAttribute('preload', 'none');
    });

    it('defaults preload to "metadata"', () => {
      const { container } = render(<AudioViewer url="https://example.com/a.mp3" priority />);
      expect(container.querySelector('audio')).toHaveAttribute('preload', 'metadata');
    });
  });

  describe('tap-to-toggle (controls=false)', () => {
    it('wrapper has role="button" and tabIndex when controls=false', () => {
      const { getByRole } = render(
        <AudioViewer url="https://example.com/a.mp3" priority controls={false} />
      );
      expect(getByRole('button')).toBeInTheDocument();
      expect(getByRole('button')).toHaveAttribute('tabindex', '0');
    });

    it('wrapper has no button role when controls=true (default)', () => {
      const { queryByRole } = render(<AudioViewer url="https://example.com/a.mp3" priority />);
      expect(queryByRole('button')).not.toBeInTheDocument();
    });

    it('clicking the wrapper calls audio.play when paused', () => {
      const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { getByRole } = render(
        <AudioViewer url="https://example.com/a.mp3" priority controls={false} />
      );
      fireEvent.click(getByRole('button'));
      expect(playSpy).toHaveBeenCalledTimes(1);
    });

    it('Enter key triggers togglePlay when controls=false', () => {
      const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { getByRole } = render(
        <AudioViewer url="https://example.com/a.mp3" priority controls={false} />
      );
      fireEvent.keyDown(getByRole('button'), { key: 'Enter' });
      expect(playSpy).toHaveBeenCalledTimes(1);
    });

    it('Space key triggers togglePlay when controls=false', () => {
      const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { getByRole } = render(
        <AudioViewer url="https://example.com/a.mp3" priority controls={false} />
      );
      fireEvent.keyDown(getByRole('button'), { key: ' ' });
      expect(playSpy).toHaveBeenCalledTimes(1);
    });

    it('other keys do not toggle playback', () => {
      const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
      const { getByRole } = render(
        <AudioViewer url="https://example.com/a.mp3" priority controls={false} />
      );
      fireEvent.keyDown(getByRole('button'), { key: 'a' });
      expect(playSpy).not.toHaveBeenCalled();
    });
  });

  describe('styling props', () => {
    it('applies className to wrapper', () => {
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority className="wrap-x" />
      );
      expect(container.firstChild).toHaveClass('wrap-x');
    });

    it('applies mediaClassName to the audio', () => {
      const { container } = render(
        <AudioViewer url="https://example.com/a.mp3" priority mediaClassName="aud-y" />
      );
      expect(container.querySelector('audio')).toHaveClass('aud-y');
    });
  });
});
