"use client";

import type { ChatMessageV1, ModerationHandlers } from "../types";
import { cn } from "@ttt-productions/ui-core";
import { MessageActions } from "./menus";

export function MessageItemDefault(props: {
  m: ChatMessageV1;
  currentUserId: string;
  isAdmin: boolean;
  handlers?: ModerationHandlers;
}) {
  const { m, currentUserId, isAdmin, handlers } = props;
  const mine = m.senderId === currentUserId;

  return (
    <div
      className={cn(
        "flex flex-col w-fit max-w-[85%]",
        mine ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      <div className={cn("p-3 rounded-lg", mine ? "bg-primary/10" : "bg-muted")}>
        <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
          <span className="font-medium">{m.senderUsername ?? "User"}</span>
          <span>·</span>
          <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        </div>
        {m.text && <p className="text-sm whitespace-pre-wrap">{m.text}</p>}
      </div>

      <div className="mt-1">
        <MessageActions messageId={m.messageId} isAdmin={isAdmin} handlers={handlers} />
      </div>
    </div>
  );
}
