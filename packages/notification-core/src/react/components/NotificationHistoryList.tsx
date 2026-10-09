'use client';

import { Badge, ListPagination, Separator, Spinner } from '@ttt-productions/ui-core/react';
import { useNotificationHistory } from '../hooks/useNotificationHistory.js';
import { NotificationEmptyState } from './NotificationEmptyState.js';
import { NotificationTypeIcon } from './notification-type-icon.js';
import { formatRelativeTime } from './relative-time.js';
import type { NotificationHistoryItem, NotificationHistoryListProps } from '../../types.js';

/**
 * Read-only, paginated list of ARCHIVED notifications (the history tier). Rows are
 * inert and read-only — archive is one-way, there is no re-archive, so the row
 * exposes no `archive` action. Any per-row control (e.g. an
 * ArrowRight "go to") is rendered by the consumer via `renderRowAction`.
 */
export function NotificationHistoryList({
  config,
  userId,
  category,
  queryKeys,
  pageSize,
  staleTime,
  emptyText,
  labels,
  renderError,
  title,
  renderRowAction,
}: NotificationHistoryListProps) {
  const {
    data: notifications,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    page,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
  } = useNotificationHistory({
    config,
    userId,
    category,
    pageSize,
    staleTime,
    queryKeys,
  });

  const hasRows = !!notifications && notifications.length > 0;
  // A later page that came back empty keeps its pager so the user can step back; the
  // empty state is the answer for page 1 only.
  const showEmptyState =
    !isError && notifications !== undefined && notifications.length === 0 && page === 1;

  return (
    <div className="ntf-list ntf-list-history">
      {title != null && (
        <>
          <div className="ntf-list-header ntf-list-header-read-only">
            <div className="ntf-list-title">{title}</div>
          </div>
          <Separator />
        </>
      )}
      <div className="ntf-list-body">
        {isLoading ? (
          <div className="ntf-loading">
            <Spinner size="md" label={labels?.loading ?? 'Loading notifications'} />
          </div>
        ) : (
          <>
            {(notifications ?? []).map((notification: NotificationHistoryItem) => {
              return (
                <div
                  key={notification.archiveOccurrenceId}
                  className="ntf-item ntf-item-archived"
                >
                  <NotificationTypeIcon config={config} type={notification.type} />
                  <div className="ntf-item-content">
                    <div className="ntf-item-title">{notification.title}</div>
                    <div className="ntf-item-message">{notification.message}</div>
                    <div className="ntf-item-timestamp">
                      {formatRelativeTime(notification.archivedAt)}
                    </div>
                  </div>
                  {notification.count > 1 && (
                    <div className="ntf-item-count">
                      <Badge variant="secondary">×{notification.count}</Badge>
                    </div>
                  )}
                  {renderRowAction && (
                    <div className="ntf-item-row-action">
                      {renderRowAction(notification, {})}
                    </div>
                  )}
                </div>
              );
            })}
            {isError && error
              ? renderError({
                  error,
                  retry: () => {
                    void refetch();
                  },
                  retrying: isFetching,
                  hasRows,
                })
              : null}
            {showEmptyState && <NotificationEmptyState text={emptyText} />}
            <ListPagination
              pagination={{
                currentPage: page,
                canPreviousPage: hasPrevPage,
                canNextPage: hasNextPage,
                goToPreviousPage: prevPage,
                goToNextPage: nextPage,
              }}
              busy={isFetching}
              className="ntf-list-footer"
            />
          </>
        )}
      </div>
    </div>
  );
}
