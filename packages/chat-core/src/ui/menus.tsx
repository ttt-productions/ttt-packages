"use client";

import type { ModerationHandlers } from "../types";
import { Button } from "@ttt-productions/ui-core";

export function MessageActions(props: {
  messageId: string;
  isAdmin: boolean;
  handlers?: ModerationHandlers;
}) {
  const { messageId, isAdmin, handlers } = props;

  return (
    <div className="flex items-center gap-2">
      {handlers?.onReportMessage && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs opacity-70 hover:opacity-100"
          onClick={() => handlers.onReportMessage?.(messageId)}
        >
          Report
        </Button>
      )}
      {isAdmin && handlers?.onDeleteMessage && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs opacity-70 hover:opacity-100"
          onClick={() => handlers.onDeleteMessage?.(messageId)}
        >
          Delete
        </Button>
      )}
    </div>
  );
}

export function ThreadActions(props: {
  threadId: string;
  isAdmin: boolean;
  handlers?: ModerationHandlers;
}) {
  const { threadId, isAdmin, handlers } = props;

  return (
    <div className="flex items-center gap-3">
      {handlers?.onReportThread && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs opacity-70 hover:opacity-100"
          onClick={() => handlers.onReportThread?.(threadId)}
        >
          Report thread
        </Button>
      )}
      {isAdmin && handlers?.onDeleteThread && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs opacity-70 hover:opacity-100"
          onClick={() => handlers.onDeleteThread?.(threadId)}
        >
          Delete thread
        </Button>
      )}
    </div>
  );
}
