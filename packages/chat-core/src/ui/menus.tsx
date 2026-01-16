"use client";

import type { ModerationHandlers } from "../types";

export function MessageActions(props: {
  messageId: string;
  isAdmin: boolean;
  handlers?: ModerationHandlers;
}) {
  const { messageId, isAdmin, handlers } = props;

  return (
    <div className="flex items-center gap-2">
      {handlers?.onReportMessage && (
        <button
          type="button"
          className="text-xs underline opacity-70 hover:opacity-100"
          onClick={() => handlers.onReportMessage?.(messageId)}
        >
          Report
        </button>
      )}
      {isAdmin && handlers?.onDeleteMessage && (
        <button
          type="button"
          className="text-xs underline opacity-70 hover:opacity-100"
          onClick={() => handlers.onDeleteMessage?.(messageId)}
        >
          Delete
        </button>
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
        <button
          type="button"
          className="text-xs underline opacity-70 hover:opacity-100"
          onClick={() => handlers.onReportThread?.(threadId)}
        >
          Report thread
        </button>
      )}
      {isAdmin && handlers?.onDeleteThread && (
        <button
          type="button"
          className="text-xs underline opacity-70 hover:opacity-100"
          onClick={() => handlers.onDeleteThread?.(threadId)}
        >
          Delete thread
        </button>
      )}
    </div>
  );
}
