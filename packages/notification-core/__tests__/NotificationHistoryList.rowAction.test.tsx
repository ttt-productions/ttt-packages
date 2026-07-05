import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useNotificationHistory: vi.fn(),
}));

vi.mock('../src/react/hooks/useNotificationHistory.js', () => ({
  useNotificationHistory: mocks.useNotificationHistory,
}));

import { NotificationHistoryList } from '../src/react/components/NotificationHistoryList';
import type { NotificationHistoryItem, NotificationSystemConfig } from '../src/types';

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

describe('NotificationHistoryList — renderRowAction', () => {
  const onNotificationClick = vi.fn();

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
  };

  it('renders exactly as before when renderRowAction is absent', () => {
    const { container } = render(<NotificationHistoryList {...baseProps} onNotificationClick={onNotificationClick} />);
    expect(container.querySelectorAll('.ntf-item')).toHaveLength(2);
    expect(container.querySelectorAll('.ntf-item-row-action')).toHaveLength(0);
  });

  it('renders the row action per row and receives the notification', () => {
    const renderRowAction = vi.fn((notification: NotificationHistoryItem) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    render(
      <NotificationHistoryList
        {...baseProps}
        onNotificationClick={onNotificationClick}
        renderRowAction={renderRowAction}
      />,
    );

    expect(screen.getByLabelText('go-to-n1')).toBeInTheDocument();
    expect(screen.getByLabelText('go-to-n2')).toBeInTheDocument();
    expect(renderRowAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1', archiveOccurrenceId: 'occ-1' }));
    expect(renderRowAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'n2', archiveOccurrenceId: 'occ-2' }));
  });

  it('does not fire the row click handler when clicking inside the rendered action', () => {
    const renderRowAction = vi.fn((notification: NotificationHistoryItem) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    render(
      <NotificationHistoryList
        {...baseProps}
        onNotificationClick={onNotificationClick}
        renderRowAction={renderRowAction}
      />,
    );

    fireEvent.click(screen.getByLabelText('go-to-n1'));

    expect(onNotificationClick).not.toHaveBeenCalled();
  });

  it('still fires the row click handler when clicking the row itself', () => {
    const renderRowAction = vi.fn((notification: NotificationHistoryItem) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    const { container } = render(
      <NotificationHistoryList
        {...baseProps}
        onNotificationClick={onNotificationClick}
        renderRowAction={renderRowAction}
      />,
    );

    const row = container.querySelectorAll('.ntf-item')[0] as HTMLElement;
    fireEvent.click(row);

    expect(onNotificationClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
  });

  it('renders the action even when rows are non-interactive (no onNotificationClick)', () => {
    const renderRowAction = vi.fn((notification: NotificationHistoryItem) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    render(<NotificationHistoryList {...baseProps} renderRowAction={renderRowAction} />);

    expect(screen.getByLabelText('go-to-n1')).toBeInTheDocument();
  });
});
