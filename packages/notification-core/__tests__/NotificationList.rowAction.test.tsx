import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

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
import type { NotificationDoc, NotificationRowActions, NotificationSystemConfig } from '../src/types';

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

describe('NotificationList — renderRowAction (inert row + exposed archive)', () => {
  const archiveMutateAsync = vi.fn().mockResolvedValue({ archived: true });

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
    archiveMutateAsync.mockResolvedValue({ archived: true });
  });

  const baseProps = {
    config: makeConfig(),
    userId: 'u1',
    category: 'user',
    archiveFn: vi.fn(),
    enqueueArchiveAllFn: vi.fn(),
    getArchiveAllStatusFn: vi.fn(),
    renderError: () => <div role="alert">read failed</div>,
  };

  it('while loading, renders an announced spinner — never the empty state', () => {
    mocks.useActiveNotifications.mockReturnValue({
      data: undefined,
      isLoading: true,
      hasNextPage: false,
      nextPage: vi.fn(),
    });
    const { container } = render(<NotificationList {...baseProps} emptyText="No notifications" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading notifications');
    expect(container.querySelector('.ntf-loading .spinner-md')).toBeInTheDocument();
    expect(screen.queryByText('No notifications')).toBeNull();
  });

  it('pages with the canonical Previous / Next row — Next replaces the list, so there is no "Load more"', () => {
    const prevPage = vi.fn();
    const nextPage = vi.fn();
    mocks.useActiveNotifications.mockReturnValue({
      data: [makeNotification({ id: 'n1' })],
      isLoading: false,
      isFetching: false,
      page: 2,
      hasNextPage: true,
      hasPrevPage: true,
      nextPage,
      prevPage,
    });
    render(<NotificationList {...baseProps} />);

    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(prevPage).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(nextPage).toHaveBeenCalledTimes(1);
  });

  it('renders a plain row with no action slot when renderRowAction is absent', () => {
    const { container } = render(<NotificationList {...baseProps} />);
    expect(container.querySelectorAll('.ntf-item')).toHaveLength(2);
    expect(container.querySelectorAll('.ntf-item-row-action')).toHaveLength(0);
  });

  it('renders the supplied title on the left and Clear All on the right', () => {
    const { container } = render(<NotificationList {...baseProps} title="Notifications" />);
    const header = container.querySelector('.ntf-list-header')!;
    expect(header.querySelector('.ntf-list-title')).toHaveTextContent('Notifications');
    expect(header.querySelector('.ntf-list-clear-all')).toHaveTextContent('Clear All');
    expect(header.firstElementChild).toHaveClass('ntf-list-title');
    expect(header.querySelector('.ntf-list-clear-all')).toBe(header.children[1]);
  });

  it('renders the row action per row and receives the notification + an archive action', () => {
    const renderRowAction = vi.fn((notification: NotificationDoc) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    expect(screen.getByLabelText('go-to-n1')).toBeInTheDocument();
    expect(screen.getByLabelText('go-to-n2')).toBeInTheDocument();
    expect(renderRowAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1' }),
      expect.objectContaining({ archive: expect.any(Function) }),
    );
  });

  it('makes the row itself inert — no role=button and a row click archives nothing', () => {
    const renderRowAction = vi.fn((notification: NotificationDoc) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    const { container } = render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    const row = container.querySelectorAll('.ntf-item')[0] as HTMLElement;
    expect(row).not.toHaveAttribute('role', 'button');
    fireEvent.click(row);
    expect(archiveMutateAsync).not.toHaveBeenCalled();
  });

  it('archives that row when the exposed archive action is invoked', async () => {
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <button aria-label={`clear-${notification.id}`} onClick={() => actions.archive?.()}>
        Clear
      </button>
    );
    render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    fireEvent.click(screen.getByLabelText('clear-n1'));
    await waitFor(() =>
      expect(archiveMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1', type: 'content_report' })),
    );
  });

  it('marks every targeted row pending while Clear All is running', async () => {
    let resolveClearAll: (value: { complete: boolean }) => void = () => {};
    mocks.useArchiveAllNotifications.mockReturnValue({
      mutateAsync: vi.fn(
        () => new Promise<{ complete: boolean }>((resolve) => { resolveClearAll = resolve; }),
      ),
      isPending: false,
    });
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <span data-testid={`pending-${notification.id}`}>{String(actions.isArchivePending)}</span>
    );

    render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);
    fireEvent.click(screen.getByText('Clear All'));

    await waitFor(() => expect(screen.getByTestId('pending-n1')).toHaveTextContent('true'));
    expect(screen.getByTestId('pending-n2')).toHaveTextContent('true');
    expect(screen.getByRole('button', { name: 'Clearing...' }).querySelector('.spinner-xs')).not.toBeNull();
    await act(async () => { resolveClearAll({ complete: false }); });
  });

  it('marks only the targeted row pending during a single archive', async () => {
    let resolveArchive: (value: { archived: boolean }) => void = () => {};
    archiveMutateAsync.mockImplementationOnce(
      () => new Promise<{ archived: boolean }>((resolve) => { resolveArchive = resolve; }),
    );
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <button
        aria-label={`${actions.isArchivePending ? 'pending' : 'clear'}-${notification.id}`}
        onClick={() => { void actions.archive?.(); }}
      >
        {actions.isArchivePending ? 'Pending' : 'Clear'}
      </button>
    );
    const view = render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    fireEvent.click(screen.getByLabelText('clear-n1'));
    await waitFor(() => expect(screen.getByLabelText('pending-n1')).toBeInTheDocument());
    expect(screen.getByLabelText('clear-n2')).toBeInTheDocument();

    await act(async () => { resolveArchive({ archived: true }); });
    // Callable completion is not authoritative: the row keeps spinning while
    // it remains in the active query.
    expect(screen.getByLabelText('pending-n1')).toBeInTheDocument();

    mocks.useActiveNotifications.mockReturnValue({
      data: [makeNotification({ id: 'n2' })],
      isLoading: false,
      hasNextPage: false,
      nextPage: vi.fn(),
    });
    view.rerender(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);
    await waitFor(() => expect(screen.queryByLabelText('pending-n1')).toBeNull());
  });

  it('stops a row spinner on archive failure while the row remains active', async () => {
    let rejectArchive: (error: Error) => void = () => {};
    archiveMutateAsync.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => { rejectArchive = reject; }),
    );
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <button
        aria-label={`${actions.isArchivePending ? 'pending' : 'clear'}-${notification.id}`}
        onClick={() => { void actions.archive?.().catch(() => {}); }}
      >
        Clear
      </button>
    );
    render(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    fireEvent.click(screen.getByLabelText('clear-n1'));
    await waitFor(() => expect(screen.getByLabelText('pending-n1')).toBeInTheDocument());
    await act(async () => { rejectArchive(new Error('archive failed')); });
    await waitFor(() => expect(screen.getByLabelText('clear-n1')).toBeInTheDocument());
    expect(screen.getByLabelText('clear-n2')).toBeInTheDocument();
  });
});

describe('NotificationList — archive answers, failed pages, and rendered rows', () => {
  const archiveMutateAsync = vi.fn();
  const props = {
    config: makeConfig(),
    userId: 'u1',
    category: 'user',
    archiveFn: vi.fn(),
    enqueueArchiveAllFn: vi.fn(),
    getArchiveAllStatusFn: vi.fn(),
    emptyText: 'No notifications',
    renderError: ({ retry, hasRows }: { retry: () => void; hasRows: boolean }) => (
      <button role="alert" data-has-rows={String(hasRows)} onClick={retry}>read failed</button>
    ),
  };
  const page = (over: Record<string, unknown>) => ({
    data: [makeNotification({ id: 'n1' })],
    isLoading: false, isFetching: false, isError: false, error: null, refetch: vi.fn(),
    page: 1, hasNextPage: false, hasPrevPage: false, nextPage: vi.fn(), prevPage: vi.fn(),
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useArchiveNotification.mockReturnValue({ mutateAsync: archiveMutateAsync });
    mocks.useArchiveAllNotifications.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('clears the row pending state at once when the server archived nothing', async () => {
    mocks.useActiveNotifications.mockReturnValue(page({}));
    archiveMutateAsync.mockResolvedValueOnce({ archived: false });
    const renderRowAction = (n: NotificationDoc, actions: NotificationRowActions) => (
      <button
        aria-label={`${actions.isArchivePending ? 'pending' : 'clear'}-${n.id}`}
        onClick={() => { void actions.archive?.(); }}
      >
        x
      </button>
    );
    render(<NotificationList {...props} renderRowAction={renderRowAction} />);
    fireEvent.click(screen.getByLabelText('clear-n1'));
    await waitFor(() => expect(archiveMutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText('clear-n1')).toBeInTheDocument());
  });

  it('renders the error slot, never the empty state, when the first read fails', () => {
    mocks.useActiveNotifications.mockReturnValue(page({ data: undefined, isError: true, error: new Error('denied') }));
    render(<NotificationList {...props} />);
    expect(screen.getByRole('alert')).toHaveAttribute('data-has-rows', 'false');
    expect(screen.queryByText('No notifications')).toBeNull();
  });

  it('retries the displayed page from the error slot', () => {
    const refetch = vi.fn();
    mocks.useActiveNotifications.mockReturnValue(page({ data: undefined, isError: true, error: new Error('x'), refetch }));
    render(<NotificationList {...props} />);
    fireEvent.click(screen.getByRole('alert'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('keeps the rows on screen beside the error slot when a refresh fails', () => {
    mocks.useActiveNotifications.mockReturnValue(page({ isError: true, error: new Error('x') }));
    const { container } = render(<NotificationList {...props} />);
    expect(container.querySelectorAll('.ntf-item')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveAttribute('data-has-rows', 'true');
  });

  it('keeps Previous when a later page fails', () => {
    mocks.useActiveNotifications.mockReturnValue(
      page({ data: undefined, isError: true, error: new Error('x'), page: 2, hasPrevPage: true }),
    );
    render(<NotificationList {...props} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  it('keeps Previous on an empty later page and shows no empty state there', () => {
    mocks.useActiveNotifications.mockReturnValue(page({ data: [], page: 2, hasPrevPage: true }));
    render(<NotificationList {...props} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    expect(screen.queryByText('No notifications')).toBeNull();
  });

  it('shows the empty state for an answered, empty first page', () => {
    mocks.useActiveNotifications.mockReturnValue(page({ data: [] }));
    render(<NotificationList {...props} />);
    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('reports the rows on screen, whichever page is displayed', () => {
    const rows = [makeNotification({ id: 'p2a' }), makeNotification({ id: 'p2b' })];
    mocks.useActiveNotifications.mockReturnValue(page({ data: rows, page: 2, hasPrevPage: true }));
    const onRenderedRowsChange = vi.fn();
    render(<NotificationList {...props} onRenderedRowsChange={onRenderedRowsChange} />);
    expect(onRenderedRowsChange).toHaveBeenLastCalledWith(rows);
  });

  it('reports nothing while the page is still loading', () => {
    mocks.useActiveNotifications.mockReturnValue(page({ data: undefined, isLoading: true }));
    const onRenderedRowsChange = vi.fn();
    render(<NotificationList {...props} onRenderedRowsChange={onRenderedRowsChange} />);
    expect(onRenderedRowsChange).not.toHaveBeenCalled();
  });
});

describe('NotificationList — focus keeps a destination', () => {
  const archiveMutateAsync = vi.fn();
  const props = {
    config: makeConfig(),
    userId: 'u1',
    category: 'user',
    archiveFn: vi.fn(),
    enqueueArchiveAllFn: vi.fn(),
    getArchiveAllStatusFn: vi.fn(),
    title: 'Notifications',
    renderError: () => <div role="alert">read failed</div>,
  };
  const page = (rows: NotificationDoc[], over: Record<string, unknown> = {}) => ({
    data: rows,
    isLoading: false, isFetching: false, isError: false, error: null, refetch: vi.fn(),
    page: 1, hasNextPage: false, hasPrevPage: false, nextPage: vi.fn(), prevPage: vi.fn(),
    ...over,
  });
  const clearControl = (n: NotificationDoc, actions: NotificationRowActions) => (
    <button aria-label={`clear-${n.id}`} onClick={() => { void actions.archive?.(); }}>x</button>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useArchiveNotification.mockReturnValue({ mutateAsync: archiveMutateAsync });
    mocks.useArchiveAllNotifications.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('moves focus to the next row control when the focused row leaves the list', () => {
    const rows = [makeNotification({ id: 'n1' }), makeNotification({ id: 'n2' }), makeNotification({ id: 'n3' })];
    mocks.useActiveNotifications.mockReturnValue(page(rows));
    const view = render(<NotificationList {...props} renderRowAction={clearControl} />);
    screen.getByLabelText('clear-n2').focus();

    mocks.useActiveNotifications.mockReturnValue(page([rows[0], rows[2]]));
    view.rerender(<NotificationList {...props} renderRowAction={clearControl} />);

    expect(screen.getByLabelText('clear-n3')).toHaveFocus();
  });

  it('moves focus to the list itself when the focused row was the last one', () => {
    const rows = [makeNotification({ id: 'n1' }), makeNotification({ id: 'n2' })];
    mocks.useActiveNotifications.mockReturnValue(page(rows));
    const view = render(<NotificationList {...props} renderRowAction={clearControl} />);
    screen.getByLabelText('clear-n2').focus();

    mocks.useActiveNotifications.mockReturnValue(page([rows[0]]));
    view.rerender(<NotificationList {...props} renderRowAction={clearControl} />);

    expect(screen.getByRole('group', { name: 'Notifications' })).toHaveFocus();
  });

  it('leaves focus alone when it had already moved out of the row that left', () => {
    const rows = [makeNotification({ id: 'n1' }), makeNotification({ id: 'n2' })];
    mocks.useActiveNotifications.mockReturnValue(page(rows));
    const view = render(
      <>
        <button>elsewhere</button>
        <NotificationList {...props} renderRowAction={clearControl} />
      </>,
    );
    screen.getByLabelText('clear-n1').focus();
    screen.getByRole('button', { name: 'elsewhere' }).focus();

    mocks.useActiveNotifications.mockReturnValue(page([rows[1]]));
    view.rerender(
      <>
        <button>elsewhere</button>
        <NotificationList {...props} renderRowAction={clearControl} />
      </>,
    );

    expect(screen.getByRole('button', { name: 'elsewhere' })).toHaveFocus();
  });


  it('Clear All keeps focus when the list empties under it, and then clears nothing', () => {
    const mutateAsync = vi.fn().mockResolvedValue({ complete: true });
    mocks.useArchiveAllNotifications.mockReturnValue({ mutateAsync, isPending: false });
    mocks.useActiveNotifications.mockReturnValue(page([makeNotification({ id: 'n1' })]));
    const view = render(<NotificationList {...props} />);
    const clearAll = screen.getByRole('button', { name: 'Clear All' });
    clearAll.focus();

    mocks.useActiveNotifications.mockReturnValue(page([]));
    view.rerender(<NotificationList {...props} />);

    expect(clearAll).not.toBeDisabled();
    expect(clearAll).toHaveAttribute('aria-disabled', 'true');
    expect(clearAll).toHaveFocus();
    fireEvent.click(clearAll);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
