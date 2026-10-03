import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useNotificationHistory: vi.fn(),
}));

vi.mock('../src/react/hooks/useNotificationHistory.js', () => ({
  useNotificationHistory: mocks.useNotificationHistory,
}));

import { NotificationHistoryList } from '../src/react/components/NotificationHistoryList';
import type { NotificationHistoryItem, NotificationRowActions, NotificationSystemConfig } from '../src/types';

function makeConfig(): NotificationSystemConfig {
  return {
    categories: {
      user: {
        activePath: 'activeUserNotifications',
        historyPath: (uid) => `userProfiles/${uid}/notificationHistory`,
        audienceType: 'personal',
      },
    },
    types: {},
  };
}

function makeHistoryItem(overrides: Partial<NotificationHistoryItem> = {}): NotificationHistoryItem {
  return {
    id: 'n1',
    type: 'content_report',
    dedupKey: 'dedup1',
    category: 'user',
    targetUserId: 'u1',
    title: 'Title',
    message: 'Message',
    count: 1,
    latestActorIds: [],
    targetPath: '/somewhere',
    metadata: {},
    seenAt: 0,
    createdAt: 1,
    updatedAt: 1,
    archiveOccurrenceId: 'occ-1',
    archivedAt: 2,
    ...overrides,
  };
}

describe('NotificationHistoryList — renderRowAction (inert, read-only rows)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useNotificationHistory.mockReturnValue({
      data: [
        makeHistoryItem({ id: 'n1', archiveOccurrenceId: 'occ-1' }),
        makeHistoryItem({ id: 'n2', archiveOccurrenceId: 'occ-2' }),
      ],
      isLoading: false,
      hasNextPage: false,
      nextPage: vi.fn(),
    });
  });

  const baseProps = {
    config: makeConfig(),
    userId: 'u1',
    category: 'user',
    renderError: () => <div role="alert">read failed</div>,
  };

  it('renders a plain row with no action slot when renderRowAction is absent', () => {
    const { container } = render(<NotificationHistoryList {...baseProps} />);
    expect(container.querySelectorAll('.ntf-item')).toHaveLength(2);
    expect(container.querySelectorAll('.ntf-item-row-action')).toHaveLength(0);
  });

  it('renders a read-only title header with no Clear All control', () => {
    const { container } = render(
      <NotificationHistoryList {...baseProps} title="Notifications" />,
    );
    expect(container.querySelector('.ntf-list-title')).toHaveTextContent('Notifications');
    expect(screen.queryByText('Clear All')).toBeNull();
  });

  it('renders the row action per row, receiving the item and NO archive action (read-only)', () => {
    const seen: NotificationRowActions[] = [];
    const renderRowAction = vi.fn((notification: NotificationHistoryItem, actions: NotificationRowActions) => {
      seen.push(actions);
      return <button aria-label={`go-to-${notification.id}`}>Go</button>;
    });
    render(<NotificationHistoryList {...baseProps} renderRowAction={renderRowAction} />);

    expect(screen.getByLabelText('go-to-n1')).toBeInTheDocument();
    expect(screen.getByLabelText('go-to-n2')).toBeInTheDocument();
    expect(renderRowAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', archiveOccurrenceId: 'occ-1' }),
      expect.anything(),
    );
    // Archived rows cannot be re-archived — no archive action is exposed.
    expect(seen.every((a) => a.archive === undefined && a.isArchivePending === undefined)).toBe(true);
  });

  it('makes the archived row inert — no role=button', () => {
    const renderRowAction = (notification: NotificationHistoryItem) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    );
    const { container } = render(<NotificationHistoryList {...baseProps} renderRowAction={renderRowAction} />);

    const row = container.querySelectorAll('.ntf-item')[0] as HTMLElement;
    expect(row).not.toHaveAttribute('role', 'button');
    // Clicking the row is a no-op (nothing throws, no handler).
    fireEvent.click(row);
  });
});

describe('NotificationHistoryList — failed and empty pages', () => {
  const props = {
    config: makeConfig(),
    userId: 'u1',
    category: 'user',
    emptyText: 'No archived notifications',
    renderError: () => <div role="alert">read failed</div>,
  };

  it('renders the error slot, never the empty state, when the first read fails', () => {
    mocks.useNotificationHistory.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: new Error('denied'),
      page: 1, hasNextPage: false, hasPrevPage: false, nextPage: vi.fn(), prevPage: vi.fn(),
    });
    render(<NotificationHistoryList {...props} />);
    expect(screen.getByRole('alert')).toHaveTextContent('read failed');
    expect(screen.queryByText('No archived notifications')).toBeNull();
  });

  it('keeps Previous on an empty later page and shows no empty state there', () => {
    mocks.useNotificationHistory.mockReturnValue({
      data: [], isLoading: false, isError: false, page: 2,
      hasNextPage: false, hasPrevPage: true, nextPage: vi.fn(), prevPage: vi.fn(),
    });
    render(<NotificationHistoryList {...props} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.queryByText('No archived notifications')).toBeNull();
  });

  it('shows the empty state for an answered, empty first page', () => {
    mocks.useNotificationHistory.mockReturnValue({
      data: [], isLoading: false, isError: false, page: 1,
      hasNextPage: false, hasPrevPage: false, nextPage: vi.fn(), prevPage: vi.fn(),
    });
    render(<NotificationHistoryList {...props} />);
    expect(screen.getByText('No archived notifications')).toBeInTheDocument();
  });
});
