'use client';

import { useCallback, useState } from 'react';
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
  enqueueArchiveAllFn,
  getArchiveAllStatusFn,
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
    enqueueArchiveAllFn,
    getArchiveAllStatusFn,
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

  // Surface a failed/incomplete clear instead of swallowing it. `onClearAll` (and the tray-closing
  // side effects the app wires to it) fires ONLY when the server job fully drained the category —
  // otherwise the user keeps the "notifications remain — try again" affordance. The poller resolves
  // with an explicit terminal result (`complete` | `incomplete` | `failed`) and only rejects on a
  // hard enqueue/poll throw.
  const [clearIncomplete, setClearIncomplete] = useState(false);

  const handleClearAll = useCallback(async () => {
    setClearIncomplete(false);
    let result;
    try {
      result = await archiveAllMutation.mutateAsync();
    } catch {
      // Hard failure (enqueue/poll threw): do not fire onClearAll; surface the retry affordance.
      setClearIncomplete(true);
      return;
    }
    if (!result.complete) {
      // Job terminated without fully draining the category (incomplete/failed) — keep the
      // notifications and prompt a retry.
      setClearIncomplete(true);
      return;
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
        {clearIncomplete && !archiveAllMutation.isPending && (
          <div className="ntf-list-clear-error" role="status">
            Some notifications remain — try again.
          </div>
        )}
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
