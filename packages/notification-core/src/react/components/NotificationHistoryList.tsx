'use client';

import { useCallback } from 'react';
import { Badge, Button, Separator } from '@ttt-productions/ui-core/react';
import { useNotificationHistory } from '../hooks/useNotificationHistory.js';
import { NotificationEmptyState } from './NotificationEmptyState.js';
import { formatRelativeTime } from './relative-time.js';
import type { NotificationHistoryItem, NotificationHistoryListProps } from '../../types.js';

/**
 * Read-only, paginated list of ARCHIVED notifications (the history tier). Rows are
 * inert (DJ ruling 2026-07-07) and read-only — archive is one-way, there is no
 * re-archive, so the row exposes no `archive` action. Any per-row control (e.g. an
 * ArrowRight "go to") is rendered by the consumer via `renderRowAction`.
 */
export function NotificationHistoryList({
  config,
  userId,
  category,
  pageSize,
  staleTime,
  emptyText,
  title,
  renderRowAction,
}: NotificationHistoryListProps) {
  const {
    data: notifications,
    isLoading,
    hasNextPage,
    nextPage,
  } = useNotificationHistory({
    config,
    userId,
    category,
    pageSize,
    staleTime,
  });

  const getTypeIcon = useCallback(
    (type: string) => config.types[type]?.icon ?? '🔔',
    [config],
  );

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
          <div className="ntf-loading">Loading...</div>
        ) : !notifications || notifications.length === 0 ? (
          <NotificationEmptyState text={emptyText} />
        ) : (
          <>
            {notifications.map((notification: NotificationHistoryItem) => {
              return (
                <div
                  key={notification.archiveOccurrenceId}
                  className="ntf-item ntf-item-archived"
                >
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
                    <div className="ntf-item-row-action">
                      {renderRowAction(notification, {})}
                    </div>
                  )}
                </div>
              );
            })}
            {hasNextPage && (
              <div className="ntf-list-footer">
                <Button variant="ghost" size="sm" onClick={nextPage}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
