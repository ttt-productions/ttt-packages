'use client';

import { Badge, Button, Separator } from '@ttt-productions/ui-core';
import { useNotificationHistory } from '../hooks/useNotificationHistory.js';
import { formatRelativeTime } from './relative-time.js';
import type { NotificationHistoryDoc, NotificationHistoryListProps } from '../types.js';

/**
 * Paginated list of archived notifications. Read-only (no clear all).
 * Supports optional re-navigation on click.
 */
export function NotificationHistoryList({
  config,
  userId,
  category,
  onNotificationClick,
}: NotificationHistoryListProps) {
  const {
    data: history,
    isLoading,
    hasNextPage,
    nextPage,
  } = useNotificationHistory({
    config,
    userId,
    category,
  });

  const getTypeIcon = (type: string) => {
    const typeConfig = config.types[type];
    return typeConfig?.icon ?? '🔔';
  };

  if (isLoading) {
    return <div className="ntf-loading">Loading history...</div>;
  }

  if (!history || history.length === 0) {
    return (
      <div className="ntf-empty">
        <p className="ntf-empty-text">No notification history</p>
      </div>
    );
  }

  return (
    <div className="ntf-list">
      <div className="ntf-list-header">
        <span className="ntf-list-header-title">History</span>
      </div>
      <Separator />

      {history.map((item: NotificationHistoryDoc) => {
        const isClickable = !!onNotificationClick;
        const className = isClickable
          ? 'ntf-history-item ntf-history-item--clickable'
          : 'ntf-history-item';

        return (
          <div
            key={item.id}
            className={className}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={isClickable ? () => onNotificationClick(item) : undefined}
            onKeyDown={
              isClickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNotificationClick(item);
                    }
                  }
                : undefined
            }
          >
            <div className="ntf-item-icon">
              {getTypeIcon(item.type)}
            </div>
            <div className="ntf-item-content">
              <div className="ntf-item-title">{item.title}</div>
              <div className="ntf-item-message">{item.message}</div>
              <div className="ntf-item-timestamp">
                {formatRelativeTime(item.archival.archivedAt)}
              </div>
            </div>
            {item.count > 1 && (
              <div className="ntf-item-count">
                <Badge variant="secondary">×{item.count}</Badge>
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
    </div>
  );
}
