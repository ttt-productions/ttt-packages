'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Skeleton,
} from '@ttt-productions/ui-core';
import { Briefcase, AlertTriangle } from 'lucide-react';
import { useReportCoreContext } from '../context/ReportCoreProvider.js';
import { useCheckedOutTasks } from '../hooks/useCheckedOutTasks.js';
import { CountdownTimer } from './CountdownTimer.js';
import { PriorityBadge } from './PriorityBadge.js';
import type { CheckedOutTaskListProps } from '../types.js';

/**
 * Renders the list of tasks currently checked out by the given admin.
 * Each task is clickable to resume work.
 *
 * Requires a `userId` prop — the consuming app provides the current admin's UID.
 */
export function CheckedOutTaskList({
  onItemSelect,
  userId,
}: CheckedOutTaskListProps & { userId: string | undefined }) {
  const { config } = useReportCoreContext();
  const { data: tasks, isLoading, error } = useCheckedOutTasks(userId);

  if (isLoading) {
    return (
      <Card className="w-full">
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
        <CardContent className="p-4 text-center text-destructive center-row gap-2">
          <AlertTriangle className="icon-sm" />
          <p>Could not load your checked-out tasks.</p>
        </CardContent>
      </Card>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase />
            My Checked-Out Tasks (0)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted text-center py-4">
            You have no tasks checked out.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase />
          My Checked-Out Tasks ({tasks.length})
        </CardTitle>
        <CardDescription>
          Click a task to continue working on it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task) => {
          const queueConfig = config.taskQueues[task.taskType];
          return (
            <Button
              key={task.id}
              onClick={() => onItemSelect(task)}
              variant="outline"
              className="w-full h-auto justify-between p-3"
            >
              <div className="text-left space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-small">
                    {queueConfig?.displayName ?? task.taskType}
                  </p>
                  <PriorityBadge priority={task.priority} />
                </div>
                <p className="text-caption truncate max-w-xs sm:max-w-sm">
                  {task.summary}
                </p>
              </div>
              <div className="w-28 flex-shrink-0 ml-4">
                <CountdownTimer
                  expiresAtMillis={task.checkoutDetails.expiresAt}
                  checkedOutAtMillis={task.checkoutDetails.checkedOutAt}
                />
              </div>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
