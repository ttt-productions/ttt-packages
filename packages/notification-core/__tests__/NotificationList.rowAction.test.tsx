import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  useActiveNotifications: vi.fn(),
  useArchiveNotification: vi.fn(),
  useArchiveAllNotifications: vi.fn(),
}));

vi.mock('../src/react/hooks/useActiveNotifications.js', () => ({
  useActiveNotifications: mocks.useActiveNotifications,
}));
vi.mock('../src/react/hooks/useArchiveNotification.js', () => ({
  useArchiveNotification: mocks.useArchiveNotification,
}));
vi.mock('../src/react/hooks/useArchiveAllNotifications.js', () => ({
  useArchiveAllNotifications: mocks.useArchiveAllNotifications,
}));

import { NotificationList } from '../src/react/components/NotificationList';
import type { NotificationDoc, NotificationSystemConfig } from '../src/types';

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

function makeNotification(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
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
    ...overrides,
  };
}

describe('NotificationList — renderRowAction', () => {
  const onNotificationClick = vi.fn();
  const archiveMutateAsync = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useActiveNotifications.mockReturnValue({
      data: [makeNotification({ id: 'n1' }), makeNotification({ id: 'n2' })],
      isLoading: false,
      hasNextPage: false,
      nextPage: vi.fn(),
    });
    mocks.useArchiveNotification.mockReturnValue({
      mutateAsync: archiveMutateAsync,
    });
    mocks.useArchiveAllNotifications.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    archiveMutateAsync.mockResolvedValue(undefined);
  });

  const baseProps = {
    config: makeConfig(),
    userId: 'u1',
    category: 'user',
    onNotificationClick,
    archiveFn: vi.fn(),
    enqueueArchiveAllFn: vi.fn(),
    getArchiveAllStatusFn: vi.fn(),
  };

  it('renders exactly as before when renderRowAction is absent', () => {
    const { container } = render(<NotificationList {...baseProps} />);
    expect(container.querySelectorAll('.ntf-item')).toHaveLength(2);
    expect(container.querySelectorAll('.ntf-item-row-action')).toHaveLength(0);
  });

  it('renders the row action per row and receives the notification', () => {
    const renderRowAction = vi.fn((notification: NotificationDoc) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    expect(screen.getByLabelText('go-to-n1')).toBeInTheDocument();
    expect(screen.getByLabelText('go-to-n2')).toBeInTheDocument();
    expect(renderRowAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
    expect(renderRowAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'n2' }));
  });

  it('does not fire the row click handler when clicking inside the rendered action', () => {
    const renderRowAction = vi.fn((notification: NotificationDoc) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    fireEvent.click(screen.getByLabelText('go-to-n1'));

    expect(onNotificationClick).not.toHaveBeenCalled();
    expect(archiveMutateAsync).not.toHaveBeenCalled();
  });

  it('still fires the row click handler when clicking the row itself', async () => {
    const renderRowAction = vi.fn((notification: NotificationDoc) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    const { container } = render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    const row = container.querySelectorAll('.ntf-item')[0] as HTMLElement;
    fireEvent.click(row);

    expect(archiveMutateAsync).toHaveBeenCalledWith('n1');
  });
});
