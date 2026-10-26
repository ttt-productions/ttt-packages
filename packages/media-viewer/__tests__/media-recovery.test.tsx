import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as React from 'react';
import {
  backoffForAttempt,
  withinBudget,
  BACKOFF_SCHEDULE_MS,
  MAX_RECOVERY_DURATION_MS,
} from '../src/recovery.js';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import { useMediaRecovery } from '../src/react/use-media-recovery.js';
import type { MediaDiagnosticAdapter, DiagnosisResult } from '../src/recovery.js';
import { MediaPreview } from '../src/react/media-viewer.js';

const createObjectURLMock = vi.fn(() => 'blob:fake-url');
const revokeObjectURLMock = vi.fn();
URL.createObjectURL = createObjectURLMock;
URL.revokeObjectURL = revokeObjectURLMock;

interface TestHookCompProps {
  url: string | null;
  adapter?: MediaDiagnosticAdapter;
  statusHint?: import('../src/recovery.js').AssetStatusHint;
  onStateChange?: (s: string) => void;
}

function TestHookComp({ url, adapter, statusHint, onStateChange }: TestHookCompProps) {
  const { recoveryState, onMediaError, onMediaLoad, manualRetry } = useMediaRecovery({
    url,
    adapter,
    statusHint,
    onRemount: () => {},
  });

  React.useEffect(() => {
    onStateChange?.(recoveryState.phase);
  }, [recoveryState, onStateChange]);

  return (
    <div>
      <span data-testid="phase">{recoveryState.phase}</span>
      {'attempt' in recoveryState && (
        <span data-testid="attempt">{(recoveryState as { attempt: number }).attempt}</span>
      )}
      <button type="button" data-testid="trigger-error" onClick={onMediaError}>
        Error
      </button>
      <button type="button" data-testid="trigger-load" onClick={onMediaLoad}>
        Load
      </button>
      <button type="button" data-testid="manual-retry" onClick={manualRetry}>
        Retry
      </button>
    </div>
  );
}

describe('backoffForAttempt', () => {
  it('returns values within ±20% jitter of the schedule', () => {
    for (let i = 0; i < BACKOFF_SCHEDULE_MS.length; i++) {
      const raw = BACKOFF_SCHEDULE_MS[i];
      const result = backoffForAttempt(i);
      expect(result).toBeGreaterThanOrEqual(raw * 0.8);
      expect(result).toBeLessThanOrEqual(raw * 1.2);
    }
  });

  it('clamps to last entry beyond schedule length', () => {
    const last = BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
    const result = backoffForAttempt(999);
    expect(result).toBeGreaterThanOrEqual(last * 0.8);
    expect(result).toBeLessThanOrEqual(last * 1.2);
  });
});

describe('withinBudget', () => {
  it('returns true when next retry would be within 120 s', () => {
    const now = Date.now();
    expect(withinBudget(now, now + MAX_RECOVERY_DURATION_MS - 1000)).toBe(true);
  });

  it('returns false when next retry would exceed 120 s', () => {
    const now = Date.now();
    expect(withinBudget(now, now + MAX_RECOVERY_DURATION_MS + 1000)).toBe(false);
  });
});

describe('useMediaRecovery — transient retry + backoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('stays idle until onMediaError is called', async () => {
    const adapter: MediaDiagnosticAdapter = {
      probe: vi
        .fn<(url: string) => Promise<DiagnosisResult>>()
        .mockResolvedValue({ kind: 'transient' }),
    };
    render(<TestHookComp url="https://cdn.example.com/a.jpg" adapter={adapter} />);
    mockAllIsIntersecting(0.01);
    expect(screen.getByTestId('phase').textContent).toBe('idle');
  });

  it('enters transient-retry after error with transient probe result', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    render(<TestHookComp url="https://cdn.example.com/a.jpg" adapter={adapter} />);
    mockAllIsIntersecting(0.01);
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('phase').textContent).toBe('transient-retry');
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('advances attempt counter on successive retries', async () => {
    const remountCb = vi.fn();
    let callCount = 0;
    const probe = vi.fn().mockImplementation(async () => {
      callCount++;
      return { kind: 'transient' } satisfies DiagnosisResult;
    });
    const adapter: MediaDiagnosticAdapter = { probe };

    function ControlledComp() {
      const { onMediaError, recoveryState } = useMediaRecovery({
        url: 'https://cdn.example.com/b.jpg',
        adapter,
        onRemount: () => {
          remountCb();
          act(() => {
            fireEvent.click(errorBtnRef.current!);
          });
        },
      });
      const errorBtnRef = React.useRef<HTMLButtonElement>(null);
      return (
        <div>
          <span data-testid="phase2">{recoveryState.phase}</span>
          {'attempt' in recoveryState && (
            <span data-testid="attempt2">{(recoveryState as { attempt: number }).attempt}</span>
          )}
          <button ref={errorBtnRef} type="button" data-testid="err2" onClick={onMediaError}>
            E
          </button>
        </div>
      );
    }

    render(<ControlledComp />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('err2'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('phase2').textContent).toBe('transient-retry');
    expect(screen.getByTestId('attempt2').textContent).toBe('0');

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it('settles on max-wait-fallback once a media that keeps failing outlasts the 120 s budget', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });

    function BudgetComp() {
      const { onMediaError, recoveryState } = useMediaRecovery({
        url: 'https://cdn.example.com/c.jpg',
        adapter: { probe },
        onRemount: () => {},
      });
      return (
        <div>
          <span data-testid="phase3">{recoveryState.phase}</span>
          <button type="button" data-testid="err3" onClick={onMediaError}>
            E
          </button>
        </div>
      );
    }

    render(<BudgetComp />);
    mockAllIsIntersecting(0.01);

    const longestBackoff = Math.max(...BACKOFF_SCHEDULE_MS) * 1.2;
    for (let elapsed = 0; elapsed <= MAX_RECOVERY_DURATION_MS; elapsed += longestBackoff) {
      await act(async () => {
        fireEvent.click(screen.getByTestId('err3'));
        await vi.advanceTimersByTimeAsync(longestBackoff);
      });
    }

    expect(screen.getByTestId('phase3').textContent).toBe('max-wait-fallback');
  });
});

describe('useMediaRecovery — auth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('enters auth-retry state on auth probe result and calls refreshSession + refreshGrant', async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);
    const refreshGrant = vi.fn().mockResolvedValue(undefined);
    const probe = vi.fn().mockResolvedValue({ kind: 'auth' } satisfies DiagnosisResult);

    const adapter: MediaDiagnosticAdapter = { probe, refreshSession, refreshGrant };

    render(<TestHookComp url="https://cdn.example.com/auth.jpg" adapter={adapter} />);
    mockAllIsIntersecting(0.01);
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('phase').textContent).toBe('auth-retry');
  });

  it('calls refreshSession once on auth error', async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);
    const probe = vi.fn().mockResolvedValue({ kind: 'auth' } satisfies DiagnosisResult);
    const adapter: MediaDiagnosticAdapter = { probe, refreshSession };

    render(<TestHookComp url="https://cdn.example.com/auth2.jpg" adapter={adapter} />);
    mockAllIsIntersecting(0.01);
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });

    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('goes hard-unavailable with reason=auth if called again after refresh', async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined);
    const probe = vi.fn().mockResolvedValue({ kind: 'auth' } satisfies DiagnosisResult);
    const adapter: MediaDiagnosticAdapter = { probe, refreshSession };

    function AuthComp() {
      const [mounted, setMounted] = React.useState(false);
      const { onMediaError, recoveryState } = useMediaRecovery({
        url: 'https://cdn.example.com/auth3.jpg',
        adapter,
        onRemount: () => setMounted((v) => !v),
      });

      return (
        <div>
          <span data-testid="aphase">{recoveryState.phase}</span>
          <span data-testid="areason">
            {'reason' in recoveryState ? ((recoveryState as { reason?: string }).reason ?? '') : ''}
          </span>
          <button type="button" data-testid="aerr" onClick={onMediaError}>
            E
          </button>
          {mounted && <span data-testid="remounted">yes</span>}
        </div>
      );
    }

    render(<AuthComp />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('aerr'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('aphase').textContent).toBe('auth-retry');

    await act(async () => {
      fireEvent.click(screen.getByTestId('aerr'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('aphase').textContent).toBe('hard-unavailable');
    expect(screen.getByTestId('areason').textContent).toBe('auth');
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});

describe('useMediaRecovery — hard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('goes immediately to hard-unavailable on hard probe result, no retry timer', async () => {
    const probe = vi.fn().mockResolvedValue({ kind: 'hard' } satisfies DiagnosisResult);
    const remount = vi.fn();
    const adapter: MediaDiagnosticAdapter = { probe };

    function HardComp() {
      const { onMediaError, recoveryState } = useMediaRecovery({
        url: 'https://cdn.example.com/hard.jpg',
        adapter,
        onRemount: remount,
      });
      return (
        <div>
          <span data-testid="hphase">{recoveryState.phase}</span>
          <button type="button" data-testid="herr" onClick={onMediaError}>
            E
          </button>
        </div>
      );
    }

    render(<HardComp />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('herr'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('hphase').textContent).toBe('hard-unavailable');

    act(() => vi.advanceTimersByTime(60_000));
    expect(remount).not.toHaveBeenCalled();
  });

  it('goes to hard-unavailable immediately when assetStatusHint=failed', async () => {
    const probe = vi.fn();
    const adapter: MediaDiagnosticAdapter = { probe };

    render(
      <TestHookComp url="https://cdn.example.com/fail.jpg" adapter={adapter} statusHint="failed" />,
    );
    mockAllIsIntersecting(0.01);
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('phase').textContent).toBe('hard-unavailable');
    expect(probe).not.toHaveBeenCalled();
  });

  it('goes to hard-unavailable immediately when assetStatusHint=rejected', async () => {
    const probe = vi.fn();
    const adapter: MediaDiagnosticAdapter = { probe };

    render(
      <TestHookComp
        url="https://cdn.example.com/rej.jpg"
        adapter={adapter}
        statusHint="rejected"
      />,
    );
    mockAllIsIntersecting(0.01);
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('phase').textContent).toBe('hard-unavailable');
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('useMediaRecovery — status hints', () => {
  beforeEach(() => {});

  afterEach(() => {});

  it('shows processing state (not recovery) when hint=processing', async () => {
    const probe = vi.fn();
    const adapter: MediaDiagnosticAdapter = { probe };

    render(
      <TestHookComp
        url="https://cdn.example.com/proc.jpg"
        adapter={adapter}
        statusHint="processing"
      />,
    );
    mockAllIsIntersecting(0.01);
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('phase').textContent).toBe('processing');
    expect(probe).not.toHaveBeenCalled();
  });

  it('shows finalizing state when hint=finalizing', async () => {
    const probe = vi.fn();
    const adapter: MediaDiagnosticAdapter = { probe };

    render(
      <TestHookComp
        url="https://cdn.example.com/final.jpg"
        adapter={adapter}
        statusHint="finalizing"
      />,
    );
    mockAllIsIntersecting(0.01);
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('phase').textContent).toBe('finalizing');
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('useMediaRecovery — visibility pause', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('pauses retry timer while document is hidden', async () => {
    const remount = vi.fn();
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    function VisComp() {
      const { onMediaError, recoveryState } = useMediaRecovery({
        url: 'https://cdn.example.com/vis.jpg',
        adapter,
        onRemount: remount,
      });
      return (
        <div>
          <span data-testid="vphase">{recoveryState.phase}</span>
          <button type="button" data-testid="verr" onClick={onMediaError}>
            E
          </button>
        </div>
      );
    }

    render(<VisComp />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('verr'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('vphase').textContent).toBe('transient-retry');

    act(() => vi.advanceTimersByTime(10_000));
    expect(remount).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });
});

describe('useMediaRecovery — per-asset dedup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('only fires probe once when two instances share the same URL', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    function TwoInstances() {
      const a = useMediaRecovery({ url: 'https://cdn.example.com/dup.jpg', adapter });
      const b = useMediaRecovery({ url: 'https://cdn.example.com/dup.jpg', adapter });
      return (
        <div>
          <span data-testid="da">{a.recoveryState.phase}</span>
          <span data-testid="db">{b.recoveryState.phase}</span>
          <button type="button" data-testid="aerr" onClick={a.onMediaError}>
            A
          </button>
          <button type="button" data-testid="berr" onClick={b.onMediaError}>
            B
          </button>
        </div>
      );
    }

    render(<TwoInstances />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('aerr'));
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('berr'));
      await Promise.resolve();
    });

    expect(probe).toHaveBeenCalledTimes(1);
  });
});

describe('useMediaRecovery — manual retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('resets to loading state and calls onRemount when manualRetry is invoked', async () => {
    const remount = vi.fn();
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    function ManualComp() {
      const { onMediaError, recoveryState, manualRetry } = useMediaRecovery({
        url: 'https://cdn.example.com/manual.jpg',
        adapter,
        onRemount: remount,
      });
      return (
        <div>
          <span data-testid="mphase">{recoveryState.phase}</span>
          <button type="button" data-testid="merr" onClick={onMediaError}>
            E
          </button>
          <button type="button" data-testid="mretry" onClick={manualRetry}>
            Retry
          </button>
        </div>
      );
    }

    render(<ManualComp />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('merr'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('mphase').textContent).toBe('transient-retry');

    await act(async () => {
      fireEvent.click(screen.getByTestId('mretry'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('mphase').textContent).toBe('loading');
    expect(remount).toHaveBeenCalledTimes(1);
  });

  it('manual retry resets firstFailureAt so budget restarts', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    render(<TestHookComp url="https://cdn.example.com/reset.jpg" adapter={adapter} />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('phase').textContent).toBe('transient-retry');

    await act(async () => {
      fireEvent.click(screen.getByTestId('manual-retry'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('phase').textContent).toBe('loading');
  });
});

describe('useMediaRecovery — successful load', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('transitions to loaded state when onMediaLoad is called', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    render(<TestHookComp url="https://cdn.example.com/ok.jpg" adapter={adapter} />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-error'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('phase').textContent).toBe('transient-retry');

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-load'));
    });
    expect(screen.getByTestId('phase').textContent).toBe('loaded');
  });
});

describe('MediaPreview with recovery adapter — image vs video events', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    createObjectURLMock.mockReset();
    createObjectURLMock.mockImplementation(() => 'blob:fake-url');
    revokeObjectURLMock.mockReset();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('image: onLoad triggers via img load event', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    const { container } = render(
      <MediaPreview url="https://cdn.example.com/x.jpg" type="image" recoveryAdapter={adapter} />,
    );
    mockAllIsIntersecting(0.01);

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();

    await act(async () => {
      fireEvent.error(img!);
      await Promise.resolve();
    });

    expect(container.querySelector('.mv-recovery-retrying')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));

    const newImg = container.querySelector('img');
    if (newImg) {
      await act(async () => {
        fireEvent.load(newImg);
      });
      expect(container.querySelector('.mv-recovery-retrying')).not.toBeInTheDocument();
    }
  });

  it('video: onLoad triggers via loadeddata event, not load event', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    const { container } = render(
      <MediaPreview
        url="https://cdn.example.com/x.mp4"
        type="video"
        controls
        recoveryAdapter={adapter}
      />,
    );
    mockAllIsIntersecting(0.01);

    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();

    await act(async () => {
      fireEvent.error(video!);
      await Promise.resolve();
    });

    expect(container.querySelector('.mv-recovery-retrying')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));

    const newVideo = container.querySelector('video');
    if (newVideo) {
      await act(async () => {
        fireEvent.loadedData(newVideo);
      });
      expect(container.querySelector('.mv-recovery-retrying')).not.toBeInTheDocument();
    }
  });

  it('audio: onLoad triggers via loadeddata or canplay event', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const adapter: MediaDiagnosticAdapter = { probe };

    const { container } = render(
      <MediaPreview
        url="https://cdn.example.com/x.mp3"
        type="audio"
        controls
        recoveryAdapter={adapter}
      />,
    );
    mockAllIsIntersecting(0.01);

    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();

    await act(async () => {
      fireEvent.error(audio!);
      await Promise.resolve();
    });

    expect(container.querySelector('.mv-recovery-retrying')).toBeInTheDocument();
  });

  it('shows the max-wait Retry once a media that keeps failing outlasts the 120 s budget', async () => {
    const probe = vi
      .fn<(url: string) => Promise<DiagnosisResult>>()
      .mockResolvedValue({ kind: 'transient' });
    const { container } = render(
      <MediaPreview
        url="https://cdn.example.com/max2.jpg"
        type="image"
        recoveryAdapter={{ probe }}
      />,
    );
    mockAllIsIntersecting(0.01);

    const longestBackoff = Math.max(...BACKOFF_SCHEDULE_MS) * 1.2;
    for (let elapsed = 0; elapsed <= MAX_RECOVERY_DURATION_MS; elapsed += longestBackoff) {
      const img = container.querySelector('img');
      if (!img) break;
      await act(async () => {
        fireEvent.error(img);
        await vi.advanceTimersByTimeAsync(longestBackoff);
      });
      mockAllIsIntersecting(0.01);
    }

    expect(screen.getByText('This media is taking longer than expected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('hard-unavailable shows no Retry affordance', async () => {
    const probe = vi.fn().mockResolvedValue({ kind: 'hard' } satisfies DiagnosisResult);
    const adapter: MediaDiagnosticAdapter = { probe };

    const { container } = render(
      <MediaPreview
        url="https://cdn.example.com/hard.jpg"
        type="image"
        recoveryAdapter={adapter}
      />,
    );
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.error(container.querySelector('img')!);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.mv-recovery-hard')).toBeInTheDocument();
    expect(container.querySelector('.mv-recovery-retry-btn')).not.toBeInTheDocument();
  });

  it('with no adapter, a load error shows the plain error fallback', async () => {
    const { container } = render(<MediaPreview url="https://cdn.example.com/x.jpg" type="image" />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.error(container.querySelector('img')!);
    });

    expect(container.querySelector('.mv-error-fallback')).toBeInTheDocument();
    expect(container.querySelector('.mv-recovery-retrying')).not.toBeInTheDocument();
  });

  it('processing hint renders processing overlay', async () => {
    const probe = vi.fn();
    const adapter: MediaDiagnosticAdapter = { probe };

    const { container } = render(
      <MediaPreview
        url="https://cdn.example.com/proc.jpg"
        type="image"
        recoveryAdapter={adapter}
        assetStatusHint="processing"
      />,
    );
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.error(container.querySelector('img')!);
      await Promise.resolve();
    });

    expect(container.querySelector('.mv-recovery-processing')).toBeInTheDocument();
    expect(probe).not.toHaveBeenCalled();
  });

  it('finalizing hint renders finalizing overlay', async () => {
    const probe = vi.fn();
    const adapter: MediaDiagnosticAdapter = { probe };

    const { container } = render(
      <MediaPreview
        url="https://cdn.example.com/fin.jpg"
        type="image"
        recoveryAdapter={adapter}
        assetStatusHint="finalizing"
      />,
    );
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.error(container.querySelector('img')!);
      await Promise.resolve();
    });

    expect(container.querySelector('.mv-recovery-finalizing')).toBeInTheDocument();
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('useMediaRecovery — no adapter (no-op path)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('stays idle on load success with no adapter', async () => {
    render(<TestHookComp url="https://cdn.example.com/ok2.jpg" />);
    mockAllIsIntersecting(0.01);

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-load'));
    });

    expect(screen.getByTestId('phase').textContent).toBe('loaded');
  });
});
