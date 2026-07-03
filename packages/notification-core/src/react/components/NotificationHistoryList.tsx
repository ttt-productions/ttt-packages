'use client';

import { useCallback } from 'react';
import { Badge, Button } from '@ttt-productions/ui-core/react';
import { useNotificationHistory } from '../hooks/useNotificationHistory.js';
import { NotificationEmptyState } from './NotificationEmptyState.js';
import { formatRelativeTime } from './relative-time.js';
import type { NotificationHistoryItem, NotificationHistoryListProps } from '../../types.js';

/**
 * Read-only, paginated list of ARCHIVED notifications (the history tier). Rows do
 * not mutate state on click — archive is one-way; there is no re-archive. When
 * `onNotificationClick` is supplied, rows are interactive (e.g. navigate to
 * `targetPath`); otherwise they render non-interactive.
 */
export function NotificationHistoryList({
  config,
  userId,
  category,
  onNotificationClick,
  pageSize,
  staleTime,
  emptyText,
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

  const interactive = typeof onNotificationClick === 'function';

  return (
    <div className="ntf-list ntf-list-history">
      <div className="ntf-list-body">
        {isLoading ? (
          <div className="ntf-loading">Loading...</div>
        ) : !notifications || notifications.length === 0 ? (
          <NotificationEmptyState text={emptyText} />
        ) : (
          <>
            {notifications.map((notification: NotificationHistoryItem) => {
              const interactiveProps = interactive
                ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => onNotificationClick?.(notification),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onNotificationClick?.(notification);
                      }
                    },
                  }
                : {};
              return (
                <div
                  key={notification.archiveOccurrenceId}
                  className="ntf-item ntf-item-archived"
                  {...interactiveProps}
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
