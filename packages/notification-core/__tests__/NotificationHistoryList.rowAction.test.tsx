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
  };

  it('renders a plain row with no action slot when renderRowAction is absent', () => {
    const { container } = render(<NotificationHistoryList {...baseProps} />);
    expect(container.querySelectorAll('.ntf-item')).toHaveLength(2);
    expect(container.querySelectorAll('.ntf-item-row-action')).toHaveLength(0);
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
    expect(seen.every((a) => a.archive === undefined)).toBe(true);
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
