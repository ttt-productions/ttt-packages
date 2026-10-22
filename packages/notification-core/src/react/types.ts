import type { ReactNode } from 'react';
import type {
  ArchiveAllJobSnapshot,
  ArchiveAllPollResult,
  EnqueueArchiveAllResult,
  NotificationArchiveFn,
  NotificationDoc,
  NotificationHistoryItem,
  NotificationListErrorState,
  NotificationRowActions,
  NotificationSystemConfig,
} from '../types.js';

export interface NotificationListProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  archiveFn: NotificationArchiveFn;
  enqueueArchiveAllFn: (category: string) => Promise<EnqueueArchiveAllResult>;
  getArchiveAllStatusFn: (jobId: string) => Promise<ArchiveAllJobSnapshot>;
  title?: ReactNode;
  onClearAll?: (result: ArchiveAllPollResult) => void;
  refetchInterval?: number;
  staleTime?: number;
  emptyText?: string;
  renderError: (state: NotificationListErrorState) => ReactNode;
  onRenderedRowsChange?: (rows: readonly NotificationDoc[]) => void;
  renderRowAction?: (notification: NotificationDoc, actions: NotificationRowActions) => ReactNode;
}

export interface NotificationHistoryListProps {
  config: NotificationSystemConfig;
  userId: string;
  category: string;
  pageSize?: number;
  staleTime?: number;
  emptyText?: string;
  renderError: (state: NotificationListErrorState) => ReactNode;
  title?: ReactNode;
  renderRowAction?: (
    notification: NotificationHistoryItem,
    actions: NotificationRowActions,
  ) => ReactNode;
}
