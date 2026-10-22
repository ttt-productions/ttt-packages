'use client';

import type { ModerationHandlers } from '@ttt-productions/chat-core';
import { Button, useAsyncAction } from '@ttt-productions/ui-core/react';

// Rethrown on a timer so the rejection reaches the global error channel, as an unawaited one would.
function reraise(error: unknown) {
  setTimeout(() => {
    throw error;
  });
}

function ModerationActionButton(props: { label: string; onAction: () => void | Promise<void> }) {
  const { label, onAction } = props;
  const action = useAsyncAction(
    async () => {
      await onAction();
    },
    { onError: reraise },
  );

  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-xs opacity-70 hover:opacity-100"
      onClick={() => void action.run()}
      pending={action.pending}
    >
      {label}
    </Button>
  );
}

export function MessageActions(props: { messageId: string; handlers?: ModerationHandlers }) {
  const { messageId, handlers } = props;
  const onReport = handlers?.onReportMessage;

  return (
    <div className="flex items-center gap-2">
      {onReport && <ModerationActionButton label="Report" onAction={() => onReport(messageId)} />}
    </div>
  );
}

export function ThreadActions(props: { threadId: string; handlers?: ModerationHandlers }) {
  const { threadId, handlers } = props;
  const onReport = handlers?.onReportThread;

  return (
    <div className="flex items-center gap-3">
      {onReport && (
        <ModerationActionButton label="Report thread" onAction={() => onReport(threadId)} />
      )}
    </div>
  );
}
