"use client";

import * as React from "react";
import type { ReloadRecoveryWatch } from "../../browser/reload-recovery-watch.js";
import type { ReloadRecoveryKind } from "../../lib/reload-recovery.js";
import { cn } from "../../lib/utils.js";
import { useAsyncAction } from "../hooks/use-async-action.js";
import { Alert, AlertDescription } from "./alert.js";
import { Button } from "./button.js";

export interface ReloadRecoveryNoticeProps {
  /** The watch the app's client entry started. */
  watch: ReloadRecoveryWatch;
  /** The app's sentence for each failure. */
  messages: Readonly<Record<ReloadRecoveryKind, React.ReactNode>>;
  /** The app's label for the refresh control. */
  refreshLabel: React.ReactNode;
  /**
   * The app's own reload, which runs its unsaved-work guard first. Refresh is pending until it
   * settles: a reload that proceeds keeps it pending until the page unloads, and a cancelled guard
   * settles it with the page, its input, and the notice as they were.
   */
  onRefresh: () => Promise<unknown>;
  /** Receives anything `onRefresh` throws. */
  onRefreshError: (error: unknown) => void;
  className?: string;
}

const noFailureOnServer = () => null;

/**
 * One notice pinned to the top of the screen once the page hits a failure only a reload repairs.
 * It cannot be dismissed and never reloads by itself: the page and every editor beneath it stay
 * mounted and usable until the person presses Refresh. A repeat of the failure changes nothing.
 */
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
        "ui-reload-recovery-notice fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 rounded-none border-x-0 border-t-0",
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
