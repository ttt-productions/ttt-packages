"use client";

import type { ModerationHandlers } from "@ttt-productions/chat-core";
import { Button, useAsyncAction } from "@ttt-productions/ui-core/react";

// The consumer's handler owns its failure UX. The action only keeps a rejection
// from vanishing: it re-raises it on the global error channel, where monitoring
// sees it — exactly where an unawaited rejection would have gone.
function reraise(error: unknown) {
  setTimeout(() => {
    throw error;
  });
}

function ModerationActionButton(props: { label: string; onAction: () => void | Promise<void> }) {
  const { label, onAction } = props;
  const action = useAsyncAction(async () => {
    await onAction();
  }, { onError: reraise });

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

export function MessageActions(props: {
  messageId: string;
  isAdmin: boolean;
  handlers?: ModerationHandlers;
}) {
  const { messageId, isAdmin, handlers } = props;
  const onReport = handlers?.onReportMessage;
  const onDelete = handlers?.onDeleteMessage;

  return (
    <div className="flex items-center gap-2">
      {onReport && <ModerationActionButton label="Report" onAction={() => onReport(messageId)} />}
      {isAdmin && onDelete && <ModerationActionButton label="Delete" onAction={() => onDelete(messageId)} />}
    </div>
  );
}

export function ThreadActions(props: {
  threadId: string;
  isAdmin: boolean;
  handlers?: ModerationHandlers;
}) {
  const { threadId, isAdmin, handlers } = props;
  const onReport = handlers?.onReportThread;
  const onDelete = handlers?.onDeleteThread;

  return (
    <div className="flex items-center gap-3">
      {onReport && <ModerationActionButton label="Report thread" onAction={() => onReport(threadId)} />}
      {isAdmin && onDelete && <ModerationActionButton label="Delete thread" onAction={() => onDelete(threadId)} />}
    </div>
  );
}
