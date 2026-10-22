'use client';

import { useCallback } from 'react';
import { Badge, ListPagination, Separator, Spinner } from '@ttt-productions/ui-core/react';
import { useNotificationHistory } from '../hooks/useNotificationHistory.js';
import { NotificationEmptyState } from './NotificationEmptyState.js';
import { formatRelativeTime } from './relative-time.js';
import type { NotificationHistoryItem } from '../../types.js';
import type { NotificationHistoryListProps } from '../types.js';

export function NotificationHistoryList({
  config,
  userId,
  category,
  pageSize,
  staleTime,
  emptyText,
  renderError,
  title,
  renderRowAction,
}: NotificationHistoryListProps) {
  const {
    data: notifications,
    isFetching,
    retryState,
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
  });

  const hasRows = !!notifications && notifications.length > 0;
  const showEmptyState =
    retryState.error === null &&
    notifications !== undefined &&
    notifications.length === 0 &&
    page === 1;

  const getTypeIcon = useCallback((type: string) => config.types[type]?.icon ?? '🔔', [config]);

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
        {retryState.isLoading ? (
          <div className="ntf-loading">
            <Spinner size="md" label="Loading notifications" />
          </div>
        ) : (
          <>
            {(notifications ?? []).map((notification: NotificationHistoryItem) => {
              return (
                <div key={notification.archiveOccurrenceId} className="ntf-item ntf-item-archived">
                  <div className="ntf-item-icon">{getTypeIcon(notification.type)}</div>
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
                    <div className="ntf-item-row-action">{renderRowAction(notification, {})}</div>
                  )}
                </div>
              );
            })}
            {retryState.error !== null
              ? renderError({
                  error: retryState.error,
                  retry: () => {
                    void refetch();
                  },
                  retrying: retryState.isRetrying,
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
              className="ntf-list-footer mt-0"
            />
          </>
        )}
      </div>
    </div>
  );
}
