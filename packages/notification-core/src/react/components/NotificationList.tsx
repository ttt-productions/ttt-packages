'use client';

import { useCallback, useEffect, useState } from 'react';
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
  archiveFn,
  enqueueArchiveAllFn,
  getArchiveAllStatusFn,
  title,
  onClearAll,
  refetchInterval,
  emptyText,
  renderRowAction,
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

  // Surface a failed/incomplete clear instead of swallowing it. `onClearAll` (and the tray-closing
  // side effects the app wires to it) fires ONLY when the server job fully drained the category —
  // otherwise the user keeps the "notifications remain — try again" affordance. The poller resolves
  // with an explicit terminal result (`complete` | `incomplete` | `failed`) and only rejects on a
  // hard enqueue/poll throw.
  const [clearIncomplete, setClearIncomplete] = useState(false);
  const [pendingArchiveIds, setPendingArchiveIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [pendingClearAllIds, setPendingClearAllIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  // Successful archive requests stay visibly pending until the authoritative
  // active-notification query removes each row. A callable response alone does
  // not prove the listener/cache has reconciled yet.
  useEffect(() => {
    if (!notifications) return;
    const activeIds = new Set(notifications.map((notification) => notification.id));
    const keepActive = (current: ReadonlySet<string>) => {
      const next = new Set([...current].filter((id) => activeIds.has(id)));
      return next.size === current.size ? current : next;
    };
    setPendingArchiveIds(keepActive);
    setPendingClearAllIds(keepActive);
  }, [notifications]);

  const archiveOne = useCallback(async (notificationId: string) => {
    setPendingArchiveIds((current) => {
      const next = new Set(current);
      next.add(notificationId);
      return next;
    });
    try {
      await archiveMutation.mutateAsync(notificationId);
    } catch (error) {
      setPendingArchiveIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
      throw error;
    }
  }, [archiveMutation]);

  const handleClearAll = useCallback(async () => {
    setClearIncomplete(false);
    setPendingClearAllIds(new Set((notifications ?? []).map((notification) => notification.id)));
    let result;
    try {
      result = await archiveAllMutation.mutateAsync();
    } catch {
      // Hard failure (enqueue/poll threw): do not fire onClearAll; surface the retry affordance.
      setPendingClearAllIds(new Set());
      setClearIncomplete(true);
      return;
    }
    if (!result.complete) {
      // Job terminated without fully draining the category (incomplete/failed) — keep the
      // notifications and prompt a retry.
      setPendingClearAllIds(new Set());
      setClearIncomplete(true);
      return;
    }
    onClearAll?.();
  }, [archiveAllMutation, notifications, onClearAll]);

  const getTypeIcon = useCallback(
    (type: string) => {
      const typeConfig = config.types[type];
      return typeConfig?.icon ?? '🔔';
    },
    [config],
  );

  const hasNotifications = !!notifications && notifications.length > 0;
  const isClearAllPending = archiveAllMutation.isPending || pendingClearAllIds.size > 0;

  return (
    <div className="ntf-list">
      <div className="ntf-list-header">
        {title != null && <div className="ntf-list-title">{title}</div>}
        <Button
          className="ntf-list-clear-all"
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          disabled={!hasNotifications || isClearAllPending}
        >
          {isClearAllPending ? 'Clearing...' : 'Clear All'}
        </Button>
        {clearIncomplete && !isClearAllPending && (
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
            <div key={notification.id} className="ntf-item">
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
              {renderRowAction && (
                <div className="ntf-item-row-action">
                  {renderRowAction(notification, {
                    archive: () => archiveOne(notification.id),
                    isArchivePending:
                      pendingClearAllIds.has(notification.id) || pendingArchiveIds.has(notification.id),
                  })}
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
