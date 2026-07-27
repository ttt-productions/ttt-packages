"use client";

import type { ChatMessageV1, ModerationHandlers } from "@ttt-productions/chat-core";
import { MessageText } from "../mentions/MessageText.js";
import { cn } from "@ttt-productions/ui-core";
import { Button } from "@ttt-productions/ui-core/react";
import { Loader2, AlertTriangle } from "lucide-react";
import { MessageActions } from "./menus.js";
import { useResolvedSenderName } from "../context/ChatNameResolverContext.js";

// A chat message renders TEXT (plus its reply quote and send-state rows). Files
// live in the conversation's Conversation Files surface, never in the timeline —
// there is no attachment body here.

// ============================================
// Correlated send-rejection copy + retry policy
// ============================================

// User-facing copy per correlated `send-rejected` code (stamped on meta.sendFailureCode
// by the realtime channel client). A failed send with no code (a transport/exhausted
// reconnect failure) falls back to the neutral "Couldn't send".
const SEND_FAILURE_COPY: Record<string, string> = {
  "blocked-word": "Message contains blocked language",
  "archived": "This channel is read-only",
  "deleted": "This channel is read-only",
  "membership-pending": "Chat is still preparing",
  "wordlist-unavailable": "Chat safety check is temporarily unavailable",
  "flood": "Please wait before sending again",
  "slow-mode": "Please wait before sending again",
};

function sendFailureCopy(code: string | null): string {
  return (code && SEND_FAILURE_COPY[code]) || "Couldn't send";
}

// Retry policy comes from meta.sendRetryable, stamped by the channel client from
// the wire contract's canonical retryability table (chat-schemas enforces the
// frame's `retryable` matches the table, so this is the ONE source of truth —
// never a second hardcoded code list here, which would have to move in lockstep
// with the contract). `false` = terminal (an unchanged resend is guaranteed to
// fail — no Retry action); `true` or ABSENT (a code-less transport/exhausted
// reconnect failure) keeps Retry, reusing the ORIGINAL clientMessageId.
function isRetryableFailure(meta: Record<string, unknown> | undefined): boolean {
  return meta?.sendRetryable !== false;
}

// ============================================
// Reply-to quote
// ============================================

function ReplyQuote({ replyTo }: { replyTo: NonNullable<ChatMessageV1["replyTo"]> }) {
  const replyName = useResolvedSenderName(replyTo.senderId);
  return (
    <div className="chat-reply-quote">
      <span className="chat-reply-quote-sender">{replyName}</span>
      <span className="chat-reply-quote-preview"><MessageText text={replyTo.messagePreview} /></span>
    </div>
  );
}

// ============================================
// System message
// ============================================

// System lines are the conversation's action record (agreed / retracted / offer updated /
// finalized…), so each carries its time — same hour:minute format as the message bubbles.
function SystemMessage({ m }: { m: ChatMessageV1 }) {
  return (
    <div className="chat-system-message">
      {m.text && <span>{m.text}</span>}
      <span className="chat-system-message-time">
        {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
    </div>
  );
}

// ============================================
// Default message item
// ============================================

export type MessageItemDefaultProps = {
  m: ChatMessageV1;
  currentUserId: string;
  isAdmin: boolean;
  handlers?: ModerationHandlers;

  // Grouping
  isContinuation?: boolean;

  // Sender interaction
  onSenderClick?: (senderId: string, displayName: string) => void;

  /** Retry a failed realtime send by its original clientMessageId (wired by
   *  ChatShell on the realtime transport; absent on firestore). Enables the
   *  retry affordance on a `meta.sendFailed` bubble. */
  onRetrySend?: (clientMessageId: string) => void;
};

export function MessageItemDefault(props: MessageItemDefaultProps) {
  const { m, currentUserId, isAdmin, handlers, isContinuation, onSenderClick, onRetrySend } = props;
  const senderName = useResolvedSenderName(m.senderId);

  // System messages render differently
  if (m.isSystemMessage) {
    return <SystemMessage m={m} />;
  }

  const mine = m.senderId === currentUserId;

  // Realtime optimistic-send lifecycle (meta is stamped by the channel client):
  // an un-acked echo renders subtly pending; one past the retry/age cap renders a
  // visibly failed bubble with a retry affordance (same clientMessageId — the DO
  // dedups, so a retry can never double-send).
  const sendFailed = m.meta?.sendFailed === true;
  const sendPending = m.meta?.optimistic === true && !sendFailed;
  const clientMessageId =
    typeof m.meta?.clientMessageId === "string" ? m.meta.clientMessageId : null;
  // Correlated rejection reason (from the `send-rejected` frame), if any — drives
  // both the failure copy and whether a Retry affordance is offered.
  const sendFailureCode =
    typeof m.meta?.sendFailureCode === "string" ? m.meta.sendFailureCode : null;
  const showRetry = sendFailed && isRetryableFailure(m.meta);

  return (
    <div
      className={cn(
        "flex flex-col w-fit max-w-[85%]",
        mine ? "ml-auto items-end" : "mr-auto items-start",
        isContinuation ? "chat-continuation-gap" : "chat-group-gap"
      )}
    >
      <div
        className={cn(
          "chat-bubble",
          mine ? "chat-bubble--mine" : "chat-bubble--theirs",
          sendPending && "chat-bubble--pending",
          sendFailed && "chat-bubble--failed"
        )}
      >
        {!isContinuation && (
          <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
            <span
              className={cn("font-medium", onSenderClick && "cursor-pointer hover:underline")}
              onClick={onSenderClick ? () => onSenderClick(m.senderId, senderName) : undefined}
              role={onSenderClick ? "button" : undefined}
              tabIndex={onSenderClick ? 0 : undefined}
              onKeyDown={onSenderClick ? (e) => {
                if (e.key === "Enter" || e.key === " ") onSenderClick(m.senderId, senderName);
              } : undefined}
            >
              {senderName}
            </span>
            <span>·</span>
            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          </div>
        )}

        {m.replyTo && <ReplyQuote replyTo={m.replyTo} />}

        {m.text && (
          <p className="text-sm whitespace-pre-wrap">
            <MessageText text={m.text} />
          </p>
        )}
      </div>

      {/* Send-state status rows render regardless of grouping — a pending/failed
          send must never be indistinguishable from a delivered one. */}
      {sendPending && (
        <div className="chat-send-status mt-0.5" role="status" aria-live="polite">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          <span>Sending…</span>
        </div>
      )}
      {sendFailed && (
        <div className="chat-send-status chat-send-status--failed mt-0.5" role="alert">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>{sendFailureCopy(sendFailureCode)}</span>
          {showRetry && onRetrySend && clientMessageId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[0.6875rem]"
              onClick={() => onRetrySend(clientMessageId)}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {!isContinuation && (
        <div className="mt-1">
          <MessageActions messageId={m.messageId} isAdmin={isAdmin} handlers={handlers} />
        </div>
      )}
    </div>
  );
}
