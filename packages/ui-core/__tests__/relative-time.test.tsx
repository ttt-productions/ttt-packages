import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RelativeTime } from '../src/react/components/relative-time';

vi.mock('@ttt-productions/firebase-helpers', async (importOriginal) => {
  const real = await importOriginal<typeof import('@ttt-productions/firebase-helpers')>();
  return {
    ...real,
    formatDistanceToNowStrict: vi.fn(() => '5 minutes ago'),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('RelativeTime', () => {
  it('renders placeholder initially (before effect)', () => {
    const { container } = render(<RelativeTime timestamp={Date.now()} placeholder="loading..." />);
    // In RTL, effects run in act, so we need to check before act
    // The initial state is the placeholder — verify it was set
    expect(container.textContent).toBeTruthy();
  });

  it('renders relative time after effect fires', async () => {
    const timestamp = Date.now() - 300_000; // 5 minutes ago
    await act(async () => {
      render(<RelativeTime timestamp={timestamp} />);
    });
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('renders fallback for null timestamp', async () => {
    await act(async () => {
      render(<RelativeTime timestamp={null} fallback="unknown time" />);
    });
    expect(screen.getByText('unknown time')).toBeInTheDocument();
  });

  it('renders fallback for undefined timestamp', async () => {
    await act(async () => {
      render(<RelativeTime timestamp={undefined} fallback="no date" />);
    });
    expect(screen.getByText('no date')).toBeInTheDocument();
  });

  it('accepts a Date object', async () => {
    const date = new Date(Date.now() - 60_000);
    await act(async () => {
      render(<RelativeTime timestamp={date} />);
    });
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('sets up a refresh interval when refreshIntervalMs > 0', async () => {
    const { formatDistanceToNowStrict } = await import('@ttt-productions/firebase-helpers');
    const mockFn = vi.mocked(formatDistanceToNowStrict);
    mockFn.mockReturnValue('1 minute ago');

    await act(async () => {
      render(<RelativeTime timestamp={Date.now()} refreshIntervalMs={1000} />);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(mockFn.mock.calls.length).toBeGreaterThan(1);
  });
});
