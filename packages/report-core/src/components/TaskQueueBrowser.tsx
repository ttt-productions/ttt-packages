'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Skeleton,
} from '@ttt-productions/ui-core';
import { FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import { useTaskQueue } from '../hooks/useTaskQueue.js';
import { PriorityBadge } from './PriorityBadge.js';
import type { TaskQueueBrowserProps, AdminTask } from '../types.js';

/**
 * Browse a specific task queue with pagination.
 * Shows tasks sorted by priority and age.
 * Provides a checkout button that calls the app's checkout function.
 */
export function TaskQueueBrowser({
  taskType,
  renderTaskRow,
}: TaskQueueBrowserProps & {
  /** Optional custom renderer for each task row. Falls back to default. */
  renderTaskRow?: (task: AdminTask) => React.ReactNode;
}) {
  const { config } = useReportCoreContext();
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useTaskQueue({ taskType, page });

  const queueConfig = config.taskQueues[taskType];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-4 text-center text-destructive">
          Failed to load queue: {error.message}
        </CardContent>
      </Card>
    );
  }

  const tasks = data?.tasks ?? [];
  const hasMore = data?.hasMore ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen />
          {queueConfig?.displayName ?? taskType} Queue
        </CardTitle>
        {queueConfig?.description && (
          <CardDescription>{queueConfig.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {tasks.length === 0 ? (
          <p className="text-muted text-center py-4">
            No pending tasks in this queue.
          </p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) =>
              renderTaskRow ? (
                <div key={task.id}>{renderTaskRow(task)}</div>
              ) : (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={task.priority} />
                      <span className="text-small">{task.summary}</span>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* Pagination */}
        {(page > 1 || hasMore) && (
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="icon-xs mr-1" /> Previous
            </Button>
            <span className="text-caption">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              Next <ChevronRight className="icon-xs ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
