'use client';

import * as React from 'react';
import type { ReloadRecoveryWatch } from '../../browser/reload-recovery-watch.js';
import type { ReloadRecoveryKind } from '../../lib/reload-recovery.js';
import { cn } from '../../lib/utils.js';
import { useAsyncAction } from '../hooks/use-async-action.js';
import { Alert, AlertDescription } from './alert.js';
import { Button } from './button.js';

export interface ReloadRecoveryNoticeProps {
  watch: ReloadRecoveryWatch;
  messages: Readonly<Record<ReloadRecoveryKind, React.ReactNode>>;
  refreshLabel: React.ReactNode;
  onRefresh: () => Promise<unknown>;
  onRefreshError: (error: unknown) => void;
  className?: string;
}

const noFailureOnServer = () => null;

export function ReloadRecoveryNotice({
  watch,
  messages,
  refreshLabel,
  onRefresh,
  onRefreshError,
  className,
}: ReloadRecoveryNoticeProps) {
  const kind = React.useSyncExternalStore(watch.subscribe, watch.current, noFailureOnServer);
  const refresh = useAsyncAction(onRefresh, { onError: onRefreshError });
  if (kind === null) return null;
  return (
    <Alert
      className={cn(
        'ui-reload-recovery-notice fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 rounded-none border-x-0 border-t-0',
        className,
      )}
    >
      <AlertDescription>{messages[kind]}</AlertDescription>
      <Button type="button" size="sm" pending={refresh.pending} onClick={() => void refresh.run()}>
        {refreshLabel}
      </Button>
    </Alert>
  );
}
