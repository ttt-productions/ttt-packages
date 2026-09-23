import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const pull = vi.hoisted(() => ({
  state: { isRefreshing: false, pullProgress: 0, pullDistance: 0 },
}));

vi.mock('../../src/react/pull-to-refresh/usePullToRefresh.js', () => ({
  usePullToRefresh: () => ({
    ...pull.state,
    handlers: { onTouchStart: () => {}, onTouchMove: () => {}, onTouchEnd: () => {} },
    style: {},
  }),
}));

import { PullToRefreshContainer } from '../../src/react/pull-to-refresh/PullToRefreshContainer';

describe('PullToRefreshContainer', () => {
  beforeEach(() => {
    pull.state = { isRefreshing: false, pullProgress: 0, pullDistance: 0 };
  });

  it('shows the consumer refreshing indicator in place of the ring while refreshing', () => {
    pull.state = { isRefreshing: true, pullProgress: 1, pullDistance: 0 };
    const { container } = render(
      <PullToRefreshContainer onRefresh={async () => {}} refreshingIndicator={<span data-testid="app-spinner" />}>
        <p>content</p>
      </PullToRefreshContainer>,
    );
    expect(screen.getByTestId('app-spinner')).toBeInTheDocument();
    expect(container.querySelector('circle')).toBeNull();
  });

  it('keeps the progress ring during the pull, even with a refreshing indicator supplied', () => {
    pull.state = { isRefreshing: false, pullProgress: 0.5, pullDistance: 40 };
    const { container } = render(
      <PullToRefreshContainer onRefresh={async () => {}} refreshingIndicator={<span data-testid="app-spinner" />}>
        <p>content</p>
      </PullToRefreshContainer>,
    );
    expect(screen.queryByTestId('app-spinner')).toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('without a refreshing indicator, the ring spins for the refresh as before', () => {
    pull.state = { isRefreshing: true, pullProgress: 1, pullDistance: 0 };
    const { container } = render(
      <PullToRefreshContainer onRefresh={async () => {}}>
        <p>content</p>
      </PullToRefreshContainer>,
    );
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });
});
