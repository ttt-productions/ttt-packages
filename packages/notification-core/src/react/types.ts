import type { ReactNode } from 'react';
import type {
  ArchiveAllJobSnapshot,
  ArchiveAllPollResult,
  EnqueueArchiveAllResult,
  NotificationArchiveFn,
  NotificationDoc,
  NotificationHistoryItem,
  NotificationListErrorState,
  NotificationRowActions,
  NotificationSystemConfig,
} from '../types.js';

export interface NotificationListProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  /**
   * Archives one rendered notification. Passed straight through to
   * `useArchiveNotification`; the app wires it to its callable.
   */
  archiveFn: NotificationArchiveFn;
  /**
   * Adapter that ENQUEUES one server-owned archive-all job scoped to `category` and returns its
   * `jobId`. Passed straight through to `useArchiveAllNotifications`; the app wires it to its
   * enqueue callable. Per-tab scoping: the category flows through to the job.
   */
  enqueueArchiveAllFn: (category: string) => Promise<EnqueueArchiveAllResult>;
  /**
   * Adapter that returns the current status snapshot for an archive-all `jobId`. Passed straight
   * through to `useArchiveAllNotifications`, which polls it until the job is terminal; the app wires
   * it to its status callable / job-doc read.
   */
  getArchiveAllStatusFn: (jobId: string) => Promise<ArchiveAllJobSnapshot>;
  /** Left-aligned title for the active-list header. */
  title?: ReactNode;
  /**
   * Fires with the terminal result ONLY when the archive-all job completed — the whole category was
   * walked. A complete result can still carry `notArchived > 0` (cards that each failed and stay in
   * the list); the copy for that is the app's.
   */
  onClearAll?: (result: ArchiveAllPollResult) => void;
  /** Re-read the displayed page every `refetchInterval` ms while mounted (default 30s). */
  refetchInterval?: number;
  /** How long a read page counts as fresh, in ms (default 30s). */
  staleTime?: number;
  /** Empty-state text, shown only for an answered, empty first page. */
  emptyText?: string;
  /** The failed-read state, shown before (never instead of) the pager. Copy is the app's. */
  renderError: (state: NotificationListErrorState) => ReactNode;
  /**
   * Called with the rows on screen each time the displayed page's answered rows change
   * (not while a page is loading or failed with nothing shown) — the rows to mark seen.
   */
  onRenderedRowsChange?: (rows: readonly NotificationDoc[]) => void;
  /**
   * Per-row control slot. The row itself is inert; the consumer renders the row's
   * controls here — typically an ArrowRight "go to" (which may call `actions.archive`
   * then navigate) plus a clear/archive button (calls `actions.archive`). Omit to render
   * a row with no controls.
   */
  renderRowAction?: (notification: NotificationDoc, actions: NotificationRowActions) => ReactNode;
}

export interface NotificationHistoryListProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  pageSize?: number;
  staleTime?: number;
  /** Empty-state text, shown only for an answered, empty first page. */
  emptyText?: string;
  /** The failed-read state, shown before (never instead of) the pager. Copy is the app's. */
  renderError: (state: NotificationListErrorState) => ReactNode;
  /** Left-aligned title for the read-only archived-list header. */
  title?: ReactNode;
  /**
   * Per-row control slot for archived rows. The row is inert; archived rows are
   * read-only (no re-archive), so `actions.archive` is absent — the consumer
   * typically renders only an ArrowRight "go to". Omit for a row with no controls.
   */
  renderRowAction?: (
    notification: NotificationHistoryItem,
    actions: NotificationRowActions,
  ) => ReactNode;
}
