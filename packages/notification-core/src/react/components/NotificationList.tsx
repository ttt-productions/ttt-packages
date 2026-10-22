'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Badge, Button, ListPagination, Separator, Spinner } from '@ttt-productions/ui-core/react';
import { useActiveNotifications } from '../hooks/useActiveNotifications.js';
import { useArchiveNotification } from '../hooks/useArchiveNotification.js';
import { useArchiveAllNotifications } from '../hooks/useArchiveAllNotifications.js';
import { NotificationEmptyState } from './NotificationEmptyState.js';
import { formatRelativeTime } from './relative-time.js';
import type { NotificationDoc } from '../../types.js';
import type { NotificationListProps } from '../types.js';

type PendingArchives = ReadonlyMap<string, string | undefined>;

const NO_PENDING: PendingArchives = new Map();

function isPendingFor(pending: PendingArchives, notification: NotificationDoc): boolean {
  return (
    pending.has(notification.id) && pending.get(notification.id) === notification.activityGeneration
  );
}

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  staleTime,
  emptyText,
  renderError,
  onRenderedRowsChange,
  renderRowAction,
}: NotificationListProps) {
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
  } = useActiveNotifications({
    config,
    userId,
    category,
    refetchInterval,
    staleTime,
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

  const [clearIncomplete, setClearIncomplete] = useState(false);
  const [pendingArchives, setPendingArchives] = useState<PendingArchives>(NO_PENDING);
  const [pendingClearAll, setPendingClearAll] = useState<PendingArchives>(NO_PENDING);

  const renderedRowsRef = useRef(onRenderedRowsChange);
  renderedRowsRef.current = onRenderedRowsChange;
  useEffect(() => {
    if (notifications) renderedRowsRef.current?.(notifications);
  }, [notifications]);

  useEffect(() => {
    if (!notifications) return;
    const activeGenerations = new Map(
      notifications.map((notification) => [notification.id, notification.activityGeneration]),
    );
    const keepActive = (current: PendingArchives): PendingArchives => {
      const next = new Map(
        [...current].filter(
          ([id, generation]) =>
            activeGenerations.has(id) && activeGenerations.get(id) === generation,
        ),
      );
      return next.size === current.size ? current : next;
    };
    setPendingArchives(keepActive);
    setPendingClearAll(keepActive);
  }, [notifications]);

  // A removed row takes the focused control with it and fires no blur, so focus moves to the next
  // row's control or to the list (RULE-STD-FRONTEND-203).
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const focusedRowId = useRef<string | null>(null);
  const renderedIds = useRef<readonly string[]>([]);
  useLayoutEffect(() => {
    const ids = retryState.isLoading
      ? []
      : (notifications ?? []).map((notification) => notification.id);
    const previousIds = renderedIds.current;
    renderedIds.current = ids;
    const leftId = focusedRowId.current;
    if (leftId === null || ids.includes(leftId)) return;
    focusedRowId.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.isConnected) return;

    const remaining = new Set(ids);
    const followers = previousIds
      .slice(previousIds.indexOf(leftId) + 1)
      .filter((id) => remaining.has(id));
    const nextControl = followers
      .map((id) =>
        rowRefs.current
          .get(id)
          ?.querySelector('.ntf-item-row-action')
          ?.querySelector<HTMLElement>(FOCUSABLE),
      )
      .find((control) => control != null);
    (nextControl ?? listRef.current)?.focus();
  }, [notifications, retryState.isLoading]);

  const archiveOne = useCallback(
    async (notification: NotificationDoc) => {
      const generation = notification.activityGeneration;
      const clearPending = () =>
        setPendingArchives((current) => {
          if (!current.has(notification.id) || current.get(notification.id) !== generation)
            return current;
          const next = new Map(current);
          next.delete(notification.id);
          return next;
        });
      setPendingArchives((current) => new Map(current).set(notification.id, generation));
      try {
        const result = await archiveMutation.mutateAsync(notification);
        if (!result.archived) clearPending();
      } catch (archiveError) {
        clearPending();
        throw archiveError;
      }
    },
    [archiveMutation],
  );

  const hasNotifications = !!notifications && notifications.length > 0;

  const handleClearAll = useCallback(async () => {
    if (!hasNotifications) return;
    setClearIncomplete(false);
    setPendingClearAll(
      new Map(
        (notifications ?? []).map((notification) => [
          notification.id,
          notification.activityGeneration,
        ]),
      ),
    );
    let result;
    try {
      result = await archiveAllMutation.mutateAsync();
    } catch {
      setPendingClearAll(NO_PENDING);
      setClearIncomplete(true);
      return;
    }
    if (!result.complete) {
      setPendingClearAll(NO_PENDING);
      setClearIncomplete(true);
      return;
    }
    if (result.notArchived > 0) setPendingClearAll(NO_PENDING);
    onClearAll?.(result);
  }, [archiveAllMutation, hasNotifications, notifications, onClearAll]);

  const getTypeIcon = useCallback(
    (type: string) => {
      const typeConfig = config.types[type];
      return typeConfig?.icon ?? '🔔';
    },
    [config],
  );

  const showEmptyState =
    retryState.error === null &&
    notifications !== undefined &&
    notifications.length === 0 &&
    page === 1;
  const isClearAllPending =
    archiveAllMutation.isPending ||
    (notifications ?? []).some((notification) => isPendingFor(pendingClearAll, notification));
  const titleId = useId();

  return (
    <div
      ref={listRef}
      className="ntf-list"
      role="group"
      aria-labelledby={title != null ? titleId : undefined}
      tabIndex={-1}
    >
      <div className="ntf-list-header">
        {title != null && (
          <div id={titleId} className="ntf-list-title">
            {title}
          </div>
        )}
        {/* Never natively disabled: focus must keep a destination as the list empties (RULE-STD-FRONTEND-203). */}
        <Button
          type="button"
          className="ntf-list-clear-all"
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          aria-disabled={!hasNotifications || undefined}
          pending={isClearAllPending}
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
        {retryState.isLoading ? (
          <div className="ntf-loading">
            <Spinner size="md" label="Loading notifications" />
          </div>
        ) : (
          <>
            {(notifications ?? []).map((notification: NotificationDoc) => (
              <div
                key={notification.id}
                ref={(row) => {
                  if (row) rowRefs.current.set(notification.id, row);
                  else rowRefs.current.delete(notification.id);
                }}
                className="ntf-item"
                onFocus={() => {
                  focusedRowId.current = notification.id;
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    focusedRowId.current = null;
                  }
                }}
              >
                <div className="ntf-item-icon">{getTypeIcon(notification.type)}</div>
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
                      archive: () => archiveOne(notification),
                      isArchivePending:
                        isPendingFor(pendingClearAll, notification) ||
                        isPendingFor(pendingArchives, notification),
                    })}
                  </div>
                )}
              </div>
            ))}
            {retryState.error !== null
              ? renderError({
                  error: retryState.error,
                  retry: () => {
                    void refetch();
                  },
                  retrying: retryState.isRetrying,
                  hasRows: hasNotifications,
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
