'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Badge, Button, ListPagination, Separator, Spinner } from '@ttt-productions/ui-core/react';
import { useActiveNotifications } from '../hooks/useActiveNotifications.js';
import { useArchiveNotification } from '../hooks/useArchiveNotification.js';
import { useArchiveAllNotifications } from '../hooks/useArchiveAllNotifications.js';
import { NotificationEmptyState } from './NotificationEmptyState.js';
import { NotificationTypeIcon } from './notification-type-icon.js';
import { formatRelativeTime } from './relative-time.js';
import type {
  NotificationArchiveResult,
  NotificationDoc,
  NotificationListLabels,
  NotificationListProps,
} from '../../types.js';

const DEFAULT_LABELS: NotificationListLabels = {
  clearAll: 'Clear All',
  clearing: 'Clearing...',
  clearIncomplete: 'Some notifications remain — try again.',
  loading: 'Loading notifications',
};

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  queryKeys,
  title,
  onClearAll,
  refetchInterval,
  staleTime,
  emptyText,
  labels,
  renderError,
  onRenderedRowsChange,
  renderRowAction,
}: NotificationListProps) {
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
  } = useActiveNotifications({
    config,
    userId,
    category,
    refetchInterval,
    staleTime,
    queryKeys,
  });

  const archiveMutation = useArchiveNotification({
    userId,
    category,
    archiveFn,
    queryKeys,
  });

  const archiveAllMutation = useArchiveAllNotifications({
    userId,
    category,
    enqueueArchiveAllFn,
    getArchiveAllStatusFn,
    queryKeys,
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

  const renderedRowsRef = useRef(onRenderedRowsChange);
  renderedRowsRef.current = onRenderedRowsChange;
  useEffect(() => {
    if (notifications) renderedRowsRef.current?.(notifications);
  }, [notifications]);

  // An archive the server confirmed stays visibly pending until the authoritative
  // active-notification query removes the row: the callable's answer alone does not
  // prove the read has caught up.
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

  // A row that leaves the list while focus is inside it takes the focused control with it, so focus
  // moves to the control of the row that followed it, or to the list itself (FRONTEND-203). A row's
  // removal fires no blur, so the row still recorded as focused when the rows change is the row that
  // held focus as it left.
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const focusedRowId = useRef<string | null>(null);
  const renderedIds = useRef<readonly string[]>([]);
  useLayoutEffect(() => {
    const ids = isLoading ? [] : (notifications ?? []).map((notification) => notification.id);
    const previousIds = renderedIds.current;
    renderedIds.current = ids;
    const leftId = focusedRowId.current;
    if (leftId === null || ids.includes(leftId)) return;
    focusedRowId.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.isConnected) return;

    const remaining = new Set(ids);
    const followers = previousIds.slice(previousIds.indexOf(leftId) + 1).filter((id) => remaining.has(id));
    const nextControl = followers
      .map((id) => rowRefs.current.get(id)?.querySelector('.ntf-item-row-action')?.querySelector<HTMLElement>(FOCUSABLE))
      .find((control) => control != null);
    (nextControl ?? listRef.current)?.focus();
  }, [notifications, isLoading]);

  const archiveOne = useCallback(async (notification: NotificationDoc): Promise<NotificationArchiveResult> => {
    const clearPending = () =>
      setPendingArchiveIds((current) => {
        const next = new Set(current);
        next.delete(notification.id);
        return next;
      });
    setPendingArchiveIds((current) => {
      const next = new Set(current);
      next.add(notification.id);
      return next;
    });
    try {
      const result = await archiveMutation.mutateAsync(notification);
      // Nothing was archived (the card changed after it was rendered): the row stays
      // active, so it is not left looking like it is clearing.
      if (!result.archived) clearPending();
      return result;
    } catch (archiveError) {
      clearPending();
      throw archiveError;
    }
  }, [archiveMutation]);

  const hasNotifications = !!notifications && notifications.length > 0;

  const handleClearAll = useCallback(async () => {
    if (!hasNotifications) return;
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
  }, [archiveAllMutation, hasNotifications, notifications, onClearAll]);

  // A later page that came back empty keeps its pager so the user can step back; the
  // empty state is the answer for page 1 only.
  const showEmptyState =
    !isError && notifications !== undefined && notifications.length === 0 && page === 1;
  const isClearAllPending = archiveAllMutation.isPending || pendingClearAllIds.size > 0;
  const titleId = useId();
  // Per key, so a label passed as `undefined` keeps its default rather than erasing it.
  const words: NotificationListLabels = {
    clearAll: labels?.clearAll ?? DEFAULT_LABELS.clearAll,
    clearing: labels?.clearing ?? DEFAULT_LABELS.clearing,
    clearIncomplete: labels?.clearIncomplete ?? DEFAULT_LABELS.clearIncomplete,
    loading: labels?.loading ?? DEFAULT_LABELS.loading,
  };

  return (
    <div
      ref={listRef}
      className="ntf-list"
      role="group"
      aria-labelledby={title != null ? titleId : undefined}
      tabIndex={-1}
    >
      <div className="ntf-list-header">
        {title != null && <div id={titleId} className="ntf-list-title">{title}</div>}
        {/* Unavailable with nothing to clear, but never natively disabled: the list empties under
            a Clear All that still holds focus, and focus must keep a destination (FRONTEND-203). */}
        <Button
          type="button"
          className="ntf-list-clear-all"
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          aria-disabled={!hasNotifications || undefined}
          pending={isClearAllPending}
        >
          {isClearAllPending ? words.clearing : words.clearAll}
        </Button>
        {clearIncomplete && !isClearAllPending && (
          <div className="ntf-list-clear-error" role="status">
            {words.clearIncomplete}
          </div>
        )}
      </div>
      <Separator />

      <div className="ntf-list-body">
      {isLoading ? (
        <div className="ntf-loading">
          <Spinner size="md" label={words.loading} />
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
              <NotificationTypeIcon config={config} type={notification.type} />
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
                      pendingClearAllIds.has(notification.id) || pendingArchiveIds.has(notification.id),
                  })}
                </div>
              )}
            </div>
          ))}
          {isError && error
            ? renderError({
                error,
                retry: () => {
                  void refetch();
                },
                retrying: isFetching,
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
            className="ntf-list-footer"
          />
        </>
      )}
      </div>
    </div>
  );
}
