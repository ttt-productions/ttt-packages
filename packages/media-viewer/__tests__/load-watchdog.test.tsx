/**
 * Tests for the bounded load watchdog + bounded processing/finalizing phases.
 *
 * The terminal-state guarantee: a visible, loading media element that fires
 * NEITHER a load/metadata NOR an error event within the watchdog budget
 * synthesizes an error (entering the bounded recovery path / error fallback),
 * and the hint-driven processing/finalizing overlay phases resolve to
 * max-wait-fallback after PHASE_MAX_WAIT_MS — nothing spins forever.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ImageViewer } from '../src/react/image-viewer';
import { VideoViewer } from '../src/react/video-viewer';
import { AudioViewer } from '../src/react/audio-viewer';
import { useMediaRecovery } from '../src/react/use-media-recovery';
import { LOAD_WATCHDOG_MS, PHASE_MAX_WAIT_MS } from '../src/recovery';

vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: () => {}, inView: true, entry: undefined }),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ImageViewer load watchdog', () => {
  it('synthesizes an error when neither load nor error fires within the budget', () => {
    const onError = vi.fn();
    render(<ImageViewer url="https://example.com/a.jpg" priority onError={onError} />);

    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS + 1);
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not fire after a successful load', () => {
    const onError = vi.fn();
    const { container } = render(
      <ImageViewer url="https://example.com/a.jpg" priority onError={onError} />
    );

    fireEvent.load(container.querySelector('img')!);
    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS * 2);
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('respects a custom loadTimeoutMs', () => {
    const onError = vi.fn();
    render(
      <ImageViewer url="https://example.com/a.jpg" priority onError={onError} loadTimeoutMs={5000} />
    );

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(onError).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('loadTimeoutMs=0 disables the watchdog', () => {
    const onError = vi.fn();
    render(
      <ImageViewer url="https://example.com/a.jpg" priority onError={onError} loadTimeoutMs={0} />
    );

    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS * 3);
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it('re-arms instead of failing while the document is hidden', () => {
    const onError = vi.fn();
    const visibilitySpy = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    render(<ImageViewer url="https://example.com/a.jpg" priority onError={onError} />);

    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS + 1);
    });
    // Hidden tab: the deadline re-arms instead of failing the asset.
    expect(onError).not.toHaveBeenCalled();

    visibilitySpy.mockReturnValue('visible');
    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS + 1);
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('VideoViewer load watchdog', () => {
  it('fires when no metadata arrives within the budget', () => {
    const onError = vi.fn();
    render(<VideoViewer url="https://example.com/v.mp4" priority onError={onError} />);

    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS + 1);
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('is settled by loadedmetadata alone (preload="metadata" list videos)', () => {
    const onError = vi.fn();
    const { container } = render(
      <VideoViewer url="https://example.com/v.mp4" priority onError={onError} />
    );

    fireEvent.loadedMetadata(container.querySelector('video')!);
    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS * 2);
    });
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('AudioViewer load watchdog', () => {
  it('fires when no metadata arrives within the budget', () => {
    const onError = vi.fn();
    render(<AudioViewer url="https://example.com/a.mp3" priority onError={onError} />);

    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS + 1);
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('is settled by loadedmetadata alone', () => {
    const onError = vi.fn();
    const { container } = render(
      <AudioViewer url="https://example.com/a.mp3" priority onError={onError} />
    );

    fireEvent.loadedMetadata(container.querySelector('audio')!);
    act(() => {
      vi.advanceTimersByTime(LOAD_WATCHDOG_MS * 2);
    });
    expect(onError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Bounded processing/finalizing phases
// ---------------------------------------------------------------------------

function HintedHookComp({ statusHint }: { statusHint: 'processing' | 'finalizing' }) {
  const { recoveryState, onMediaError } = useMediaRecovery({
    url: 'https://example.com/x.jpg',
    adapter: {},
    statusHint,
  });
  return (
    <div>
      <span data-testid="phase">{recoveryState.phase}</span>
      <button type="button" data-testid="trigger-error" onClick={onMediaError}>
        Error
      </button>
    </div>
  );
}

describe('bounded processing/finalizing phases', () => {
  it.each(['processing', 'finalizing'] as const)(
    '%s resolves to max-wait-fallback after PHASE_MAX_WAIT_MS',
    (hint) => {
      render(<HintedHookComp statusHint={hint} />);

      fireEvent.click(screen.getByTestId('trigger-error'));
      expect(screen.getByTestId('phase').textContent).toBe(hint);

      act(() => {
        vi.advanceTimersByTime(PHASE_MAX_WAIT_MS - 1);
      });
      expect(screen.getByTestId('phase').textContent).toBe(hint);

      act(() => {
        vi.advanceTimersByTime(2);
      });
      expect(screen.getByTestId('phase').textContent).toBe('max-wait-fallback');
    }
  );
});
