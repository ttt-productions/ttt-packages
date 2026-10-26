import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  answeredPaginatedRead,
  failedPaginatedRead,
  retryingPaginatedRead,
} from '@ttt-productions/query-core/react/testing';

type HistoryModule = typeof import('../src/react/hooks/useNotificationHistory.js');

const mocks = vi.hoisted(() => ({
  useNotificationHistory: vi.fn<HistoryModule['useNotificationHistory']>(),
}));

vi.mock(import('../src/react/hooks/useNotificationHistory.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, { useNotificationHistory: mocks.useNotificationHistory });
});

import { NotificationHistoryList } from '../src/react/components/NotificationHistoryList.js';
import type {
  NotificationHistoryItem,
  NotificationRowActions,
  NotificationSystemConfig,
} from '../src/types.js';

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

function makeHistoryItem(
  overrides: Partial<NotificationHistoryItem> = {},
): NotificationHistoryItem {
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
    mocks.useNotificationHistory.mockReturnValue(
      answeredPaginatedRead([
        makeHistoryItem({ id: 'n1', archiveOccurrenceId: 'occ-1' }),
        makeHistoryItem({ id: 'n2', archiveOccurrenceId: 'occ-2' }),
      ]),
    );
  });

  const baseProps = {
    config: makeConfig(),
    userId: 'u1',
    category: 'user',
    renderError: () => <div role="alert">read failed</div>,
  };

  it("shows each row's stored title and message when no content slot is given", () => {
    render(<NotificationHistoryList {...baseProps} />);
    expect(screen.getAllByText('Title')).toHaveLength(2);
    expect(screen.getAllByText('Message')).toHaveLength(2);
  });

  it('renders the content slot in place of the stored title and message', () => {
    const renderContent = vi.fn((notification: { id: string }) => (
      <div data-testid={`content-${notification.id}`}>Resolved for {notification.id}</div>
    ));
    render(<NotificationHistoryList {...baseProps} renderContent={renderContent} />);
    expect(screen.getByTestId('content-n1')).toHaveTextContent('Resolved for n1');
    expect(screen.getByTestId('content-n2')).toHaveTextContent('Resolved for n2');
    expect(screen.queryByText('Title')).toBeNull();
    expect(screen.queryByText('Message')).toBeNull();
    expect(renderContent.mock.calls.map(([notification]) => notification.id)).toEqual(['n1', 'n2']);
  });

  it('renders a plain row with no action slot when renderRowAction is absent', () => {
    const { container } = render(<NotificationHistoryList {...baseProps} />);
    expect(container.querySelectorAll('.ntf-item')).toHaveLength(2);
    expect(container.querySelectorAll('.ntf-item-row-action')).toHaveLength(0);
  });

  it('renders a read-only title header with no Clear All control', () => {
    const { container } = render(<NotificationHistoryList {...baseProps} title="Notifications" />);
    expect(container.querySelector('.ntf-list-title')).toHaveTextContent('Notifications');
    expect(screen.queryByText('Clear All')).toBeNull();
  });

  it('renders the row action per row, receiving the item and NO archive action (read-only)', () => {
    const seen: NotificationRowActions[] = [];
    const renderRowAction = vi.fn(
      (notification: NotificationHistoryItem, actions: NotificationRowActions) => {
        seen.push(actions);
        return <button aria-label={`go-to-${notification.id}`}>Go</button>;
      },
    );
    render(<NotificationHistoryList {...baseProps} renderRowAction={renderRowAction} />);

    expect(screen.getByLabelText('go-to-n1')).toBeInTheDocument();
    expect(screen.getByLabelText('go-to-n2')).toBeInTheDocument();
    expect(renderRowAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', archiveOccurrenceId: 'occ-1' }),
      expect.anything(),
    );
    expect(seen.every((a) => a.archive === undefined && a.isArchivePending === undefined)).toBe(
      true,
    );
  });

  it('makes the archived row inert — no role=button', () => {
    const renderRowAction = (notification: NotificationHistoryItem) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    );
    const { container } = render(
      <NotificationHistoryList {...baseProps} renderRowAction={renderRowAction} />,
    );

    const row = container.querySelectorAll('.ntf-item')[0] as HTMLElement;
    expect(row).not.toHaveAttribute('role', 'button');
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
    mocks.useNotificationHistory.mockReturnValue(failedPaginatedRead(new Error('denied')));
    render(<NotificationHistoryList {...props} />);
    expect(screen.getByRole('alert')).toHaveTextContent('read failed');
    expect(screen.queryByText('No archived notifications')).toBeNull();
  });

  it('keeps the error slot, retrying, while a failed first page retries — never the spinner', () => {
    const renderError = vi.fn(() => <div role="alert">read failed</div>);
    mocks.useNotificationHistory.mockReturnValue(retryingPaginatedRead(new Error('denied')));
    render(<NotificationHistoryList {...props} renderError={renderError} />);
    expect(screen.getByRole('alert')).toHaveTextContent('read failed');
    expect(screen.queryByRole('status')).toBeNull();
    expect(renderError).toHaveBeenLastCalledWith(
      expect.objectContaining({ retrying: true, hasRows: false }),
    );
  });

  it('keeps Previous on an empty later page and shows no empty state there', () => {
    mocks.useNotificationHistory.mockReturnValue(answeredPaginatedRead([], { page: 2 }));
    render(<NotificationHistoryList {...props} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.queryByText('No archived notifications')).toBeNull();
  });

  it('shows the empty state for an answered, empty first page', () => {
    mocks.useNotificationHistory.mockReturnValue(answeredPaginatedRead([]));
    render(<NotificationHistoryList {...props} />);
    expect(screen.getByText('No archived notifications')).toBeInTheDocument();
  });
});
