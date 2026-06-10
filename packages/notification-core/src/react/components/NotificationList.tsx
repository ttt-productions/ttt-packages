'use client';

import { useCallback } from 'react';
import { Badge, Button, Separator } from '@ttt-productions/ui-core/react';
import { useActiveNotifications } from '../hooks/useActiveNotifications.js';
import { useArchiveNotification } from '../hooks/useArchiveNotification.js';
import { useArchiveAllNotifications } from '../hooks/useArchiveAllNotifications.js';
import { NotificationEmptyState } from './NotificationEmptyState.js';
import { formatRelativeTime } from './relative-time.js';
import type { NotificationDoc, NotificationListProps } from '../../types.js';

/**
 * Scrollable list of active notifications with click-to-archive and clear-all.
 */
export function NotificationList({
  config,
  userId,
  category,
  onNotificationClick,
  archiveFn,
  archiveAllFn,
  onClearAll,
  refetchInterval,
  emptyText,
}: NotificationListProps) {
  const {
    data: notifications,
    isLoading,
    hasNextPage,
    nextPage,
  } = useActiveNotifications({
    config,
    userId,
    category,
    refetchInterval,
  });

  const archiveMutation = useArchiveNotification({
    userId,
    category,
    archiveFn,
  });

  const archiveAllMutation = useArchiveAllNotifications({
    userId,
    category,
    archiveAllFn,
  });

  const handleNotificationClick = useCallback(
    async (notification: NotificationDoc) => {
      try {
        await archiveMutation.mutateAsync(notification.id);
      } catch {
        // Still navigate even if archive fails
      }
      onNotificationClick(notification);
    },
    [archiveMutation, onNotificationClick],
  );

  const handleClearAll = useCallback(async () => {
    try {
      await archiveAllMutation.mutateAsync();
    } catch {
      // Silently fail
    }
    onClearAll?.();
  }, [archiveAllMutation, onClearAll]);

  const getTypeIcon = useCallback(
    (type: string) => {
      const typeConfig = config.types[type];
      return typeConfig?.icon ?? '🔔';
    },
    [config],
  );

  const hasNotifications = !!notifications && notifications.length > 0;

  return (
    <div className="ntf-list">
      <div className="ntf-list-header">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          disabled={!hasNotifications || archiveAllMutation.isPending}
        >
          {archiveAllMutation.isPending ? 'Clearing...' : 'Clear All'}
        </Button>
      </div>
      <Separator />

      <div className="ntf-list-body">
      {isLoading ? (
        <div className="ntf-loading">Loading...</div>
      ) : !notifications || notifications.length === 0 ? (
        <NotificationEmptyState text={emptyText} />
      ) : (
        <>
          {notifications.map((notification: NotificationDoc) => (
            <div
              key={notification.id}
              className="ntf-item"
              role="button"
              tabIndex={0}
              onClick={() => handleNotificationClick(notification)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNotificationClick(notification);
                }
              }}
            >
              <div className="ntf-item-icon">
                {getTypeIcon(notification.type)}
              </div>
              <div className="ntf-item-content">
                <div className="ntf-item-title">{notification.title}</div>
                <div className="ntf-item-message">{notification.message}</div>
                <div className="ntf-item-timestamp">
                  {formatRelativeTime(notification.updatedAt)}
                </div>
              </div>
              {notification.count > 1 && (
                <div className="ntf-item-count">
                  <Badge variant="secondary">×{notification.count}</Badge>
                </div>
              )}
            </div>
          ))}
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
