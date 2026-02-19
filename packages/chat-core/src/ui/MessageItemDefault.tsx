"use client";

import type { ChatMessageV1, ChatAttachment, ModerationHandlers } from "../types";
import { cn } from "@ttt-productions/ui-core";
import { MediaViewer } from "@ttt-productions/media-viewer";
import { Loader2, FileText, AlertTriangle, ShieldAlert } from "lucide-react";
import { MessageActions } from "./menus";

// ============================================
// Attachment rendering
// ============================================

function AttachmentPending({ att }: { att: ChatAttachment }) {
  return (
    <div className="chat-attachment-pending">
      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      <span className="text-xs text-muted-foreground truncate">{att.name}</span>
      <span className="text-xs text-muted-foreground">Processing…</span>
    </div>
  );
}

function AttachmentCompleted({ att }: { att: ChatAttachment }) {
  if (!att.url) return null;

  if (att.type === "image") {
    return <MediaViewer type="image" url={att.url} alt={att.name} className="chat-attachment-media" />;
  }
  if (att.type === "video") {
    return <MediaViewer type="video" url={att.url} controls className="chat-attachment-media" />;
  }
  if (att.type === "audio") {
    return <MediaViewer type="audio" url={att.url} controls className="chat-attachment-media" />;
  }
  // text/markdown — download link
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-attachment-text-link"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{att.name}</span>
    </a>
  );
}

function AttachmentFailed({ att }: { att: ChatAttachment }) {
  return (
    <div className="chat-attachment-failed">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-xs">{att.errorMessage || "Attachment failed to process"}</span>
    </div>
  );
}

function AttachmentRejected({ att }: { att: ChatAttachment }) {
  return (
    <div className="chat-attachment-rejected">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="text-xs">{att.errorMessage || "Attachment removed for policy violation"}</span>
    </div>
  );
}

function AttachmentRenderer({ attachment }: { attachment: ChatAttachment }) {
  switch (attachment.status) {
    case "pending":
    case "processing":
      return <AttachmentPending att={attachment} />;
    case "completed":
      return <AttachmentCompleted att={attachment} />;
    case "failed":
      return <AttachmentFailed att={attachment} />;
    case "rejected":
      return <AttachmentRejected att={attachment} />;
    default:
      return null;
  }
}

// ============================================
// Reply-to quote
// ============================================

function ReplyQuote({ replyTo }: { replyTo: NonNullable<ChatMessageV1["replyTo"]> }) {
  return (
    <div className="chat-reply-quote">
      <span className="chat-reply-quote-sender">{replyTo.senderUsername}</span>
      <span className="chat-reply-quote-preview">{replyTo.messagePreview}</span>
    </div>
  );
}

// ============================================
// System message
// ============================================

function SystemMessage({ m }: { m: ChatMessageV1 }) {
  return (
    <div className="chat-system-message">
      {m.text && <span>{m.text}</span>}
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
};

export function MessageItemDefault(props: MessageItemDefaultProps) {
  const { m, currentUserId, isAdmin, handlers, isContinuation, onSenderClick } = props;

  // System messages render differently
  if (m.isSystemMessage) {
    return <SystemMessage m={m} />;
  }

  const mine = m.senderId === currentUserId;

  return (
    <div
      className={cn(
        "flex flex-col w-fit max-w-[85%]",
        mine ? "ml-auto items-end" : "mr-auto items-start",
        isContinuation ? "chat-continuation-gap" : "chat-group-gap"
      )}
    >
      <div className={cn("chat-bubble", mine ? "chat-bubble--mine" : "chat-bubble--theirs")}>
        {/* Header — only on first message of a group */}
        {!isContinuation && (
          <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
            <span
              className={cn("font-medium", onSenderClick && "cursor-pointer hover:underline")}
              onClick={onSenderClick ? () => onSenderClick(m.senderId, m.senderUsername ?? "User") : undefined}
              role={onSenderClick ? "button" : undefined}
              tabIndex={onSenderClick ? 0 : undefined}
              onKeyDown={onSenderClick ? (e) => {
                if (e.key === "Enter" || e.key === " ") onSenderClick(m.senderId, m.senderUsername ?? "User");
              } : undefined}
            >
              {m.senderUsername ?? "User"}
            </span>
            <span>·</span>
            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          </div>
        )}

        {/* Reply-to quote */}
        {m.replyTo && <ReplyQuote replyTo={m.replyTo} />}

        {/* Message text */}
        {m.text && <p className="text-sm whitespace-pre-wrap">{m.text}</p>}

        {/* Attachment */}
        {m.attachment && (
          <div className="mt-2">
            <AttachmentRenderer attachment={m.attachment} />
          </div>
        )}
      </div>

      {/* Actions — only on first message of a group (or always if you prefer) */}
      {!isContinuation && (
        <div className="mt-1">
          <MessageActions messageId={m.messageId} isAdmin={isAdmin} handlers={handlers} />
        </div>
      )}
    </div>
  );
}
