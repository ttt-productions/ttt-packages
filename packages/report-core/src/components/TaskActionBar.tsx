'use client';

import { Button } from '@ttt-productions/ui-core';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { TaskActionBarProps } from '../types.js';

interface TaskActionBarFullProps extends TaskActionBarProps {
  /** Callable function invoker from the app. */
  callFunction: <TReq, TRes>(name: string, data?: TReq) => Promise<TRes>;
  /** Whether any action is currently in progress. */
  isLoading?: boolean;
}

/**
 * Standard action bar for admin work views.
 * Provides Release, Work Later (24h/48h), and Complete buttons.
 */
export function TaskActionBar({
  taskId,
  taskType,
  onActionComplete,
  callFunction,
  isLoading = false,
}: TaskActionBarFullProps) {
  const handleRelease = async () => {
    await callFunction('releaseTask', { taskId });
    onActionComplete();
  };

  const handleWorkLater = async (extendHours: 24 | 48) => {
    await callFunction('markWorkLater', { taskId, taskType, extendHours });
    onActionComplete();
  };

  const handleComplete = async (resolution?: string) => {
    await callFunction('checkinTask', { taskId, resolved: true, resolution });
    onActionComplete();
  };

  return (
    <div className="flex flex-wrap gap-2 pt-4 border-t">
      <Button
        variant="outline"
        onClick={handleRelease}
        disabled={isLoading}
        size="sm"
      >
        {isLoading ? <Loader2 className="mr-2 spinner-xs" /> : <XCircle className="mr-2 icon-xs" />}
        Release
      </Button>

      <Button
        variant="outline"
        onClick={() => handleWorkLater(24)}
        disabled={isLoading}
        size="sm"
      >
        <Clock className="mr-2 icon-xs" />
        Work Later (24h)
      </Button>

      <Button
        variant="outline"
        onClick={() => handleWorkLater(48)}
        disabled={isLoading}
        size="sm"
      >
        <Clock className="mr-2 icon-xs" />
        Work Later (48h)
      </Button>

      <Button
        variant="default"
        onClick={() => handleComplete()}
        disabled={isLoading}
        size="sm"
      >
        {isLoading ? <Loader2 className="mr-2 spinner-xs" /> : <CheckCircle className="mr-2 icon-xs" />}
        Mark Complete
      </Button>
    </div>
  );
}
