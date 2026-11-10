import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import {
  firestoreError,
  type ClientReadPredicate,
} from '@ttt-productions/firebase-helpers/firestore-client/testing';
import {
  firestoreTestWrapper,
  idleSessionMutation,
} from '@ttt-productions/query-core/react/testing';

const store = await vi.hoisted(async () => {
  const { makeInMemoryClientFirestore } =
    await import('@ttt-productions/firebase-helpers/firestore-client/testing');
  return makeInMemoryClientFirestore();
});

vi.mock(import('firebase/firestore'), async (importOriginal) => {
  const { clientFirestoreFake } = await import('../../../test/client-firestore-fake.js');
  return clientFirestoreFake(importOriginal, store);
});

type ArchiveModule = typeof import('../src/react/hooks/useArchiveNotification.js');
type ArchiveAllModule = typeof import('../src/react/hooks/useArchiveAllNotifications.js');

const mocks = vi.hoisted(() => ({
  useArchiveNotification: vi.fn<ArchiveModule['useArchiveNotification']>(),
  useArchiveAllNotifications: vi.fn<ArchiveAllModule['useArchiveAllNotifications']>(),
}));

vi.mock(import('../src/react/hooks/useArchiveNotification.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, { useArchiveNotification: mocks.useArchiveNotification });
});
vi.mock(import('../src/react/hooks/useArchiveAllNotifications.js'), async (importOriginal) => {
  const { stubModule } = await import('@ttt-productions/dev-standards/testing');
  return stubModule(importOriginal, {
    useArchiveAllNotifications: mocks.useArchiveAllNotifications,
  });
});

import { NotificationList } from '../src/react/components/NotificationList.js';
import { useActiveNotifications } from '../src/react/hooks/useActiveNotifications.js';
import type {
  ArchiveAllPollResult,
  NotificationArchiveResult,
  NotificationDoc,
  NotificationListErrorState,
  NotificationRowActions,
  NotificationSystemConfig,
} from '../src/types.js';
import { anyInstanceOf } from '../../../test/matchers.js';

const ACTIVE_PATH = 'activeUserNotifications';
const CEILING_TEXT = 'Archive some to see older ones.';

function makeConfig(): NotificationSystemConfig {
  return {
    categories: {
      user: {
        activePath: ACTIVE_PATH,
        historyPath: (uid) => `userProfiles/${uid}/notificationHistory`,
        audienceType: 'personal',
      },
    },
    types: {},
  };
}

function seedCard(id: string, updatedAt: number, overrides: Partial<NotificationDoc> = {}) {
  store.seed(`${ACTIVE_PATH}/${id}`, {
    type: 'content_report',
    dedupKey: `dedup-${id}`,
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
    updatedAt,
    ...overrides,
  });
}

function seedCards(count: number) {
  for (let i = 1; i <= count; i++) seedCard(`n${i}`, 1_000 - i);
}

const archiveCard = (id: string) => store.remove(`${ACTIVE_PATH}/${id}`);

const listens: ClientReadPredicate = (read) => read.listen;
const listensWithLimit =
  (size: number): ClientReadPredicate =>
  (read) =>
    read.listen && read.limit === size;

function firstMatch(predicate: ClientReadPredicate): ClientReadPredicate {
  let spent = false;
  return (read) => {
    if (spent || !predicate(read)) return false;
    spent = true;
    return true;
  };
}

function holdNext(predicate: ClientReadPredicate): () => void {
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  store.beforeRead(firstMatch(predicate), () => held);
  return () => release();
}

const unavailable = () => firestoreError('unavailable', 'unavailable');

type ArchiveMutateAsync = (notification: NotificationDoc) => Promise<NotificationArchiveResult>;
type ArchiveAllMutateAsync = () => Promise<ArchiveAllPollResult>;

function pollResult(complete: boolean): ArchiveAllPollResult {
  return {
    status: complete ? 'complete' : 'incomplete',
    category: 'user',
    archived: 0,
    notArchived: 0,
    complete,
  };
}

const archiveMutation = (mutateAsync: ArchiveMutateAsync) =>
  idleSessionMutation<NotificationArchiveResult, NotificationDoc>({ mutateAsync });

const archiveAllMutation = (mutateAsync: ArchiveAllMutateAsync) =>
  idleSessionMutation<ArchiveAllPollResult, void>({ mutateAsync });

const rowCount = (container: HTMLElement) => container.querySelectorAll('.ntf-item').length;

function renderLive(element: ReactElement, wrapper = firestoreTestWrapper(store.db).Wrapper) {
  return render(element, { wrapper });
}

const baseProps = {
  config: makeConfig(),
  userId: 'u1',
  category: 'user',
  archiveFn: vi.fn(),
  enqueueArchiveAllFn: vi.fn(),
  getArchiveAllStatusFn: vi.fn(),
  step: 10,
  ceiling: 100,
  ceilingText: CEILING_TEXT,
  renderError: () => <div role="alert">read failed</div>,
};

beforeEach(() => {
  store.reset();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('NotificationList — renderRowAction (inert row + exposed archive)', () => {
  const archiveMutateAsync = vi.fn<ArchiveMutateAsync>();

  beforeEach(() => {
    seedCard('n1', 2);
    seedCard('n2', 1);
    mocks.useArchiveNotification.mockReturnValue(archiveMutation(archiveMutateAsync));
    mocks.useArchiveAllNotifications.mockReturnValue(
      archiveAllMutation(vi.fn<ArchiveAllMutateAsync>()),
    );
    archiveMutateAsync.mockResolvedValue({ archived: true });
  });

  it('while loading, renders an announced spinner — never the empty state', () => {
    holdNext(listens);
    const { container } = renderLive(
      <NotificationList {...baseProps} emptyText="No notifications" />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading notifications');
    expect(container.querySelector('.ntf-loading .spinner-md')).toBeInTheDocument();
    expect(screen.queryByText('No notifications')).toBeNull();
  });

  it('has no Previous / Next pager', async () => {
    renderLive(<NotificationList {...baseProps} />);
    await screen.findAllByText('Title');
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it("shows each row's stored title and message when no content slot is given", async () => {
    renderLive(<NotificationList {...baseProps} />);
    expect(await screen.findAllByText('Title')).toHaveLength(2);
    expect(screen.getAllByText('Message')).toHaveLength(2);
  });

  it('renders the content slot in place of the stored title and message', async () => {
    const renderContent = vi.fn((notification: { id: string }) => (
      <div data-testid={`content-${notification.id}`}>Resolved for {notification.id}</div>
    ));
    renderLive(<NotificationList {...baseProps} renderContent={renderContent} />);
    expect(await screen.findByTestId('content-n1')).toHaveTextContent('Resolved for n1');
    expect(screen.getByTestId('content-n2')).toHaveTextContent('Resolved for n2');
    expect(screen.queryByText('Title')).toBeNull();
    expect(screen.queryByText('Message')).toBeNull();
    expect(renderContent.mock.calls.slice(-2).map(([notification]) => notification.id)).toEqual([
      'n1',
      'n2',
    ]);
  });

  it('renders a plain row with no action slot when renderRowAction is absent', async () => {
    const { container } = renderLive(<NotificationList {...baseProps} />);
    await waitFor(() => expect(rowCount(container)).toBe(2));
    expect(container.querySelectorAll('.ntf-item-row-action')).toHaveLength(0);
  });

  it('renders the supplied title on the left and Clear All on the right', () => {
    const { container } = renderLive(<NotificationList {...baseProps} title="Notifications" />);
    const header = container.querySelector('.ntf-list-header')!;
    expect(header.querySelector('.ntf-list-title')).toHaveTextContent('Notifications');
    expect(header.querySelector('.ntf-list-clear-all')).toHaveTextContent('Clear All');
    expect(header.firstElementChild).toHaveClass('ntf-list-title');
    expect(header.querySelector('.ntf-list-clear-all')).toBe(header.children[1]);
  });

  it('renders the row action per row and receives the notification + an archive action', async () => {
    const renderRowAction = vi.fn((notification: NotificationDoc) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    renderLive(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    expect(await screen.findByLabelText('go-to-n1')).toBeInTheDocument();
    expect(screen.getByLabelText('go-to-n2')).toBeInTheDocument();
    expect(renderRowAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1' }),
      expect.objectContaining({ archive: anyInstanceOf(Function) }),
    );
  });

  it('makes the row itself inert — no role=button and a row click archives nothing', async () => {
    const renderRowAction = vi.fn((notification: NotificationDoc) => (
      <button aria-label={`go-to-${notification.id}`}>Go</button>
    ));
    const { container } = renderLive(
      <NotificationList {...baseProps} renderRowAction={renderRowAction} />,
    );
    await waitFor(() => expect(rowCount(container)).toBe(2));

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
    renderLive(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    fireEvent.click(await screen.findByLabelText('clear-n1'));
    await waitFor(() =>
      expect(archiveMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'n1', type: 'content_report' }),
      ),
    );
  });

  it('marks every targeted row pending while Clear All is running', async () => {
    let resolveClearAll: (value: ArchiveAllPollResult) => void = () => {};
    mocks.useArchiveAllNotifications.mockReturnValue(
      archiveAllMutation(
        () =>
          new Promise<ArchiveAllPollResult>((resolve) => {
            resolveClearAll = resolve;
          }),
      ),
    );
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <span data-testid={`pending-${notification.id}`}>{String(actions.isArchivePending)}</span>
    );

    renderLive(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);
    await screen.findByTestId('pending-n2');
    fireEvent.click(screen.getByText('Clear All'));

    await waitFor(() => expect(screen.getByTestId('pending-n1')).toHaveTextContent('true'));
    expect(screen.getByTestId('pending-n2')).toHaveTextContent('true');
    expect(
      screen.getByRole('button', { name: 'Clearing...' }).querySelector('.spinner-xs'),
    ).not.toBeNull();
    await act(async () => {
      resolveClearAll(pollResult(false));
    });
  });

  it('marks only the targeted row pending during a single archive', async () => {
    let resolveArchive: (value: NotificationArchiveResult) => void = () => {};
    archiveMutateAsync.mockImplementationOnce(
      () =>
        new Promise<NotificationArchiveResult>((resolve) => {
          resolveArchive = resolve;
        }),
    );
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <button
        aria-label={`${actions.isArchivePending ? 'pending' : 'clear'}-${notification.id}`}
        onClick={() => {
          void actions.archive?.();
        }}
      >
        {actions.isArchivePending ? 'Pending' : 'Clear'}
      </button>
    );
    renderLive(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    fireEvent.click(await screen.findByLabelText('clear-n1'));
    await waitFor(() => expect(screen.getByLabelText('pending-n1')).toBeInTheDocument());
    expect(screen.getByLabelText('clear-n2')).toBeInTheDocument();

    await act(async () => {
      resolveArchive({ archived: true });
    });
    expect(screen.getByLabelText('pending-n1')).toBeInTheDocument();

    act(() => archiveCard('n1'));
    await waitFor(() => expect(screen.queryByLabelText('pending-n1')).toBeNull());
  });

  it('releases an archived card relit at a new generation before the read caught up', async () => {
    seedCard('n1', 2, { activityGeneration: 'g1' });
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <button
        aria-label={`${actions.isArchivePending ? 'pending' : 'clear'}-${notification.id}`}
        onClick={() => {
          void actions.archive?.();
        }}
      >
        {actions.isArchivePending ? 'Pending' : 'Clear'}
      </button>
    );
    const view = renderLive(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    fireEvent.click(await screen.findByLabelText('clear-n1'));
    await waitFor(() => expect(screen.getByLabelText('pending-n1')).toBeInTheDocument());

    view.rerender(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);
    expect(screen.getByLabelText('pending-n1')).toBeInTheDocument();

    act(() => seedCard('n1', 3, { activityGeneration: 'g2' }));
    await waitFor(() => expect(screen.getByLabelText('clear-n1')).toBeInTheDocument());
  });

  it('releases a Clear All row relit at a new generation and keeps the rest pending', async () => {
    seedCard('n1', 2, { activityGeneration: 'g1' });
    seedCard('n2', 1, { activityGeneration: 'g1' });
    let resolveClearAll: (value: ArchiveAllPollResult) => void = () => {};
    mocks.useArchiveAllNotifications.mockReturnValue(
      archiveAllMutation(
        () =>
          new Promise<ArchiveAllPollResult>((resolve) => {
            resolveClearAll = resolve;
          }),
      ),
    );
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <span data-testid={`pending-${notification.id}`}>{String(actions.isArchivePending)}</span>
    );
    renderLive(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);
    await screen.findByTestId('pending-n2');
    fireEvent.click(screen.getByText('Clear All'));
    await waitFor(() => expect(screen.getByTestId('pending-n1')).toHaveTextContent('true'));
    await act(async () => {
      resolveClearAll(pollResult(true));
    });

    act(() => seedCard('n1', 3, { activityGeneration: 'g2' }));
    await waitFor(() => expect(screen.getByTestId('pending-n1')).toHaveTextContent('false'));
    expect(screen.getByTestId('pending-n2')).toHaveTextContent('true');

    act(() => archiveCard('n2'));
    await waitFor(() => expect(screen.queryByTestId('pending-n2')).toBeNull());
    expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument();
    expect(screen.getByTestId('pending-n1')).toHaveTextContent('false');
  });

  it('hands a complete result to onClearAll and stops Clearing when cards were left in the list', async () => {
    const result: ArchiveAllPollResult = {
      status: 'complete',
      category: 'user',
      archived: 1,
      notArchived: 1,
      complete: true,
    };
    mocks.useArchiveAllNotifications.mockReturnValue(archiveAllMutation(async () => result));
    const onClearAll = vi.fn();
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <span data-testid={`pending-${notification.id}`}>{String(actions.isArchivePending)}</span>
    );
    renderLive(
      <NotificationList {...baseProps} onClearAll={onClearAll} renderRowAction={renderRowAction} />,
    );
    await screen.findByTestId('pending-n2');
    await act(async () => {
      fireEvent.click(screen.getByText('Clear All'));
    });
    expect(onClearAll).toHaveBeenCalledWith(result);

    act(() => archiveCard('n2'));
    await waitFor(() => expect(screen.queryByTestId('pending-n2')).toBeNull());
    expect(screen.getByTestId('pending-n1')).toHaveTextContent('false');
    expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument();
  });

  it('stops a row spinner on archive failure while the row remains active', async () => {
    let rejectArchive: (error: Error) => void = () => {};
    archiveMutateAsync.mockImplementationOnce(
      () =>
        new Promise<NotificationArchiveResult>((_resolve, reject) => {
          rejectArchive = reject;
        }),
    );
    const renderRowAction = (notification: NotificationDoc, actions: NotificationRowActions) => (
      <button
        aria-label={`${actions.isArchivePending ? 'pending' : 'clear'}-${notification.id}`}
        onClick={() => {
          // The list owns the failed archive's surface; this row only starts it.
          void actions.archive?.().catch(() => {});
        }}
      >
        Clear
      </button>
    );
    renderLive(<NotificationList {...baseProps} renderRowAction={renderRowAction} />);

    fireEvent.click(await screen.findByLabelText('clear-n1'));
    await waitFor(() => expect(screen.getByLabelText('pending-n1')).toBeInTheDocument());
    await act(async () => {
      rejectArchive(new Error('archive failed'));
    });
    await waitFor(() => expect(screen.getByLabelText('clear-n1')).toBeInTheDocument());
    expect(screen.getByLabelText('clear-n2')).toBeInTheDocument();
  });
});

describe('NotificationList — archive answers, failed reads, and rendered rows', () => {
  const archiveMutateAsync = vi.fn<ArchiveMutateAsync>();
  const props = {
    ...baseProps,
    emptyText: 'No notifications',
    renderError: ({ retry, hasRows }: NotificationListErrorState) => (
      <button role="alert" data-has-rows={String(hasRows)} onClick={retry}>
        read failed
      </button>
    ),
  };
  beforeEach(() => {
    mocks.useArchiveNotification.mockReturnValue(archiveMutation(archiveMutateAsync));
    mocks.useArchiveAllNotifications.mockReturnValue(
      archiveAllMutation(vi.fn<ArchiveAllMutateAsync>()),
    );
  });

  it('clears the row pending state at once when the server archived nothing', async () => {
    seedCard('n1', 1);
    archiveMutateAsync.mockResolvedValueOnce({ archived: false });
    const renderRowAction = (n: NotificationDoc, actions: NotificationRowActions) => (
      <button
        aria-label={`${actions.isArchivePending ? 'pending' : 'clear'}-${n.id}`}
        onClick={() => {
          void actions.archive?.();
        }}
      >
        x
      </button>
    );
    renderLive(<NotificationList {...props} renderRowAction={renderRowAction} />);
    fireEvent.click(await screen.findByLabelText('clear-n1'));
    await waitFor(() => expect(archiveMutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByLabelText('clear-n1')).toBeInTheDocument());
  });

  it('renders the error slot, never the empty state, when the first read fails', async () => {
    store.failReads(listens, unavailable());
    renderLive(<NotificationList {...props} />);
    expect(await screen.findByRole('alert')).toHaveAttribute('data-has-rows', 'false');
    expect(screen.queryByText('No notifications')).toBeNull();
  });

  it('re-opens the listener from the error slot', async () => {
    store.failReads(firstMatch(listens), unavailable());
    seedCard('n1', 1);
    const { container } = renderLive(<NotificationList {...props} />);
    fireEvent.click(await screen.findByRole('alert'));
    await waitFor(() => expect(rowCount(container)).toBe(1));
    expect(store.queries().filter(listens)).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the rows on screen beside the error slot when the listener fails', async () => {
    seedCard('n1', 1);
    const { container } = renderLive(<NotificationList {...props} />);
    await waitFor(() => expect(rowCount(container)).toBe(1));
    act(() => store.failListeners(listens, unavailable()));
    expect(await screen.findByRole('alert')).toHaveAttribute('data-has-rows', 'true');
    expect(rowCount(container)).toBe(1);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('shows the empty state for an answered, empty list', async () => {
    renderLive(<NotificationList {...props} />);
    expect(await screen.findByText('No notifications')).toBeInTheDocument();
  });

  it('reports the rows on screen — the window, not its look-ahead card', async () => {
    seedCards(3);
    const onRenderedRowsChange = vi.fn<(rows: readonly NotificationDoc[]) => void>();
    renderLive(
      <NotificationList {...props} step={2} onRenderedRowsChange={onRenderedRowsChange} />,
    );
    await waitFor(() => expect(onRenderedRowsChange).toHaveBeenCalled());
    expect(onRenderedRowsChange.mock.lastCall?.[0].map((row) => row.id)).toEqual(['n1', 'n2']);
  });

  it('reports nothing while the list is still loading', () => {
    seedCards(1);
    holdNext(listens);
    const onRenderedRowsChange = vi.fn();
    renderLive(<NotificationList {...props} onRenderedRowsChange={onRenderedRowsChange} />);
    expect(onRenderedRowsChange).not.toHaveBeenCalled();
  });
});

describe('NotificationList — console', () => {
  it('logs nothing about a missing queryFn when it mounts and renders the list', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.useArchiveNotification.mockReturnValue(archiveMutation(vi.fn<ArchiveMutateAsync>()));
    mocks.useArchiveAllNotifications.mockReturnValue(
      archiveAllMutation(vi.fn<ArchiveAllMutateAsync>()),
    );
    seedCards(2);
    renderLive(<NotificationList {...baseProps} />);
    expect(await screen.findAllByText('Title')).toHaveLength(2);

    const aboutQueryFn = [console.error, console.warn, console.log]
      .flatMap((method) => vi.mocked(method).mock.calls)
      .filter((args) => args.some((arg) => String(arg).includes('queryFn')));
    expect(aboutQueryFn).toEqual([]);
  });
});

describe('NotificationList — the live window', () => {
  const archiveMutateAsync = vi.fn<ArchiveMutateAsync>();
  const clearControl = (n: NotificationDoc, actions: NotificationRowActions) => (
    <button
      aria-label={`clear-${n.id}`}
      onClick={() => {
        void actions.archive?.();
      }}
    >
      x
    </button>
  );
  const shownIds = (container: HTMLElement) =>
    [...container.querySelectorAll('.ntf-item button')].map((button) =>
      button.getAttribute('aria-label')?.replace('clear-', ''),
    );

  beforeEach(() => {
    mocks.useArchiveNotification.mockReturnValue(archiveMutation(archiveMutateAsync));
    mocks.useArchiveAllNotifications.mockReturnValue(
      archiveAllMutation(vi.fn<ArchiveAllMutateAsync>()),
    );
    archiveMutateAsync.mockImplementation(async (card) => {
      archiveCard(card.id);
      return { archived: true };
    });
  });

  it('shows a list mounted after an archive whose list unmounted before the callable answered with the card gone, with no poll', async () => {
    seedCards(2);
    let answer: (value: NotificationArchiveResult) => void = () => {};
    archiveMutateAsync.mockImplementationOnce(
      () =>
        new Promise<NotificationArchiveResult>((resolve) => {
          answer = resolve;
        }),
    );
    const { Wrapper } = firestoreTestWrapper(store.db);
    const tray = renderLive(
      <NotificationList {...baseProps} renderRowAction={clearControl} />,
      Wrapper,
    );
    fireEvent.click(await screen.findByLabelText('clear-n1'));
    await waitFor(() => expect(archiveMutateAsync).toHaveBeenCalledTimes(1));
    tray.unmount();

    await act(async () => {
      archiveCard('n1');
      answer({ archived: true });
    });
    const release = holdNext(listens);
    const reopened = renderLive(
      <NotificationList {...baseProps} renderRowAction={clearControl} />,
      Wrapper,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Loading notifications');
    expect(screen.queryByLabelText('clear-n1')).toBeNull();

    act(release);
    await waitFor(() => expect(shownIds(reopened.container)).toEqual(['n2']));
    expect(store.queries().every((read) => read.listen)).toBe(true);
  });

  it('shows its rows at once, opening no second listener, when mounted while the same list is kept live', async () => {
    seedCards(2);
    const { Wrapper } = firestoreTestWrapper(store.db);
    const keptLive = renderHook(
      () =>
        useActiveNotifications({
          config: baseProps.config,
          userId: 'u1',
          category: 'user',
          step: baseProps.step,
          ceiling: baseProps.ceiling,
        }),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(keptLive.result.current.data).toHaveLength(2));

    const opened = renderLive(
      <NotificationList {...baseProps} renderRowAction={clearControl} />,
      Wrapper,
    );
    expect(shownIds(opened.container)).toEqual(['n1', 'n2']);
    expect(screen.queryByRole('status')).toBeNull();
    expect(store.queries().filter(listens)).toHaveLength(1);
    expect(store.liveListeners()).toBe(1);
  });

  it('drops a card another client archived from a mounted list, with no re-read by that list', async () => {
    seedCards(3);
    const { container } = renderLive(
      <NotificationList {...baseProps} renderRowAction={clearControl} />,
    );
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n2', 'n3']));
    const readsBefore = store.queries().length;

    act(() => archiveCard('n2'));
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n3']));
    expect(store.queries()).toHaveLength(readsBefore);
  });

  it('puts a new card at the top of a mounted list', async () => {
    seedCards(2);
    const { container } = renderLive(
      <NotificationList {...baseProps} renderRowAction={clearControl} />,
    );
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n2']));

    act(() => seedCard('fresh', 5_000));
    await waitFor(() => expect(shownIds(container)).toEqual(['fresh', 'n1', 'n2']));
  });

  it('grows the window by one step on Show more and keeps the rows already shown', async () => {
    seedCards(5);
    const { container } = renderLive(
      <NotificationList {...baseProps} step={2} renderRowAction={clearControl} />,
    );
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n2']));

    const release = holdNext(listensWithLimit(5));
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Show more' })).toHaveAttribute(
        'aria-busy',
        'true',
      ),
    );
    expect(shownIds(container).slice(0, 2)).toEqual(['n1', 'n2']);
    expect(screen.queryByRole('status', { name: 'Loading notifications' })).toBeNull();

    act(release);
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n2', 'n3', 'n4']));
    expect(screen.getByRole('button', { name: 'Show more' })).not.toHaveAttribute('aria-busy');
  });

  it('keeps the rows on screen with Show more pending when Show more is pressed offline', async () => {
    seedCards(5);
    const { container } = renderLive(
      <NotificationList {...baseProps} step={2} renderRowAction={clearControl} />,
    );
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n2']));
    act(() => store.answerFromCache(listensWithLimit(3)));
    store.answerFromCache(listensWithLimit(5));

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Show more' })).toHaveAttribute(
        'aria-busy',
        'true',
      ),
    );
    expect(shownIds(container).slice(0, 2)).toEqual(['n1', 'n2']);
    expect(screen.queryByRole('status', { name: 'Loading notifications' })).toBeNull();

    act(() => store.answerFromServer(listensWithLimit(5)));
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n2', 'n3', 'n4']));
    expect(screen.getByRole('button', { name: 'Show more' })).not.toHaveAttribute('aria-busy');
  });

  it('at the ceiling shows the line instead of Show more, refills on archive, and drops the line once nothing lies beyond', async () => {
    seedCards(6);
    const { container } = renderLive(
      <NotificationList {...baseProps} step={2} ceiling={4} renderRowAction={clearControl} />,
    );
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n2']));
    expect(screen.queryByText(CEILING_TEXT)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(shownIds(container)).toEqual(['n1', 'n2', 'n3', 'n4']));
    expect(await screen.findByText(CEILING_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();

    fireEvent.click(screen.getByLabelText('clear-n1'));
    await waitFor(() => expect(shownIds(container)).toEqual(['n2', 'n3', 'n4', 'n5']));
    expect(screen.getByText(CEILING_TEXT)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('clear-n2'));
    await waitFor(() => expect(shownIds(container)).toEqual(['n3', 'n4', 'n5', 'n6']));
    expect(screen.queryByText(CEILING_TEXT)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
});

describe('NotificationList — focus keeps a destination', () => {
  const archiveMutateAsync = vi.fn<ArchiveMutateAsync>();
  const props = { ...baseProps, title: 'Notifications' };
  const clearControl = (n: NotificationDoc, actions: NotificationRowActions) => (
    <button
      aria-label={`clear-${n.id}`}
      onClick={() => {
        void actions.archive?.();
      }}
    >
      x
    </button>
  );

  beforeEach(() => {
    mocks.useArchiveNotification.mockReturnValue(archiveMutation(archiveMutateAsync));
    mocks.useArchiveAllNotifications.mockReturnValue(
      archiveAllMutation(vi.fn<ArchiveAllMutateAsync>()),
    );
  });

  it('keeps the error slot, retrying, while a failed first read retries — never the spinner', async () => {
    store.failReads(firstMatch(listens), unavailable());
    const renderError = vi.fn((_state: NotificationListErrorState) => (
      <div role="alert">read failed</div>
    ));
    renderLive(<NotificationList {...props} renderError={renderError} />);
    await screen.findByRole('alert');

    holdNext(listens);
    act(() => renderError.mock.lastCall?.[0].retry());
    await waitFor(() =>
      expect(renderError).toHaveBeenLastCalledWith(
        expect.objectContaining({ retrying: true, hasRows: false }),
      ),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('read failed');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('moves focus to the next row control when the focused row leaves the list', async () => {
    seedCards(3);
    renderLive(<NotificationList {...props} renderRowAction={clearControl} />);
    (await screen.findByLabelText('clear-n2')).focus();

    act(() => archiveCard('n2'));
    await waitFor(() => expect(screen.queryByLabelText('clear-n2')).toBeNull());
    expect(screen.getByLabelText('clear-n3')).toHaveFocus();
  });

  it('moves focus to the list itself when the focused row was the last one', async () => {
    seedCards(2);
    renderLive(<NotificationList {...props} renderRowAction={clearControl} />);
    (await screen.findByLabelText('clear-n2')).focus();

    act(() => archiveCard('n2'));
    await waitFor(() => expect(screen.queryByLabelText('clear-n2')).toBeNull());
    expect(screen.getByRole('group', { name: 'Notifications' })).toHaveFocus();
  });

  it('leaves focus alone when it had already moved out of the row that left', async () => {
    seedCards(2);
    renderLive(
      <>
        <button>elsewhere</button>
        <NotificationList {...props} renderRowAction={clearControl} />
      </>,
    );
    (await screen.findByLabelText('clear-n1')).focus();
    screen.getByRole('button', { name: 'elsewhere' }).focus();

    act(() => archiveCard('n1'));
    await waitFor(() => expect(screen.queryByLabelText('clear-n1')).toBeNull());
    expect(screen.getByRole('button', { name: 'elsewhere' })).toHaveFocus();
  });

  it('moves focus to the list when Show more leaves after the window took in every card', async () => {
    seedCards(3);
    renderLive(<NotificationList {...props} step={2} renderRowAction={clearControl} />);
    const showMore = await screen.findByRole('button', { name: 'Show more' });
    showMore.focus();

    fireEvent.click(showMore);
    await waitFor(() => expect(screen.getByLabelText('clear-n3')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Notifications' })).toHaveFocus();
  });

  it('Clear All keeps focus when the list empties under it, and then clears nothing', async () => {
    seedCards(1);
    const mutateAsync = vi.fn<ArchiveAllMutateAsync>(async () => pollResult(true));
    mocks.useArchiveAllNotifications.mockReturnValue(archiveAllMutation(mutateAsync));
    renderLive(<NotificationList {...props} />);
    await screen.findByText('Title');
    const clearAll = screen.getByRole('button', { name: 'Clear All' });
    clearAll.focus();

    act(() => archiveCard('n1'));
    await waitFor(() => expect(screen.queryByText('Title')).toBeNull());

    expect(clearAll).not.toBeDisabled();
    expect(clearAll).toHaveAttribute('aria-disabled', 'true');
    expect(clearAll).toHaveFocus();
    fireEvent.click(clearAll);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
