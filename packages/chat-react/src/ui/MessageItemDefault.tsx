"use client";

import type { ChatMessageV1, ChatAttachment, ModerationHandlers } from "@ttt-productions/chat-core";
import { MessageText } from "../mentions/MessageText.js";
import { cn } from "@ttt-productions/ui-core";
import { MediaViewer } from "@ttt-productions/media-viewer/react";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { MessageActions } from "./menus.js";
import { useResolvedSenderName } from "../context/ChatNameResolverContext.js";

// ============================================
// Attachment rendering
// ============================================

function AttachmentView({ att }: { att: ChatAttachment }) {
  // In-flight placeholder — bytes uploaded, processing/moderation pending. No
  // `url` yet. Rendered only to the sender (other participants can't read a
  // pending doc — Firestore rules scope it until `status === 'ready'`).
  if (att.status === "pending") {
    return (
      <div className="chat-attachment-pending">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="truncate">{att.name}</span>
        <span className="chat-attachment-status-label">Sending…</span>
      </div>
    );
  }
  // Processing/moderation rejected the attachment — sender-only.
  if (att.status === "failed") {
    return (
      <div className="chat-attachment-rejected">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">{att.name}</span>
        <span className="chat-attachment-status-label">
          {att.failureReason ?? "Couldn't send this attachment"}
        </span>
      </div>
    );
  }
  // ready (or legacy/absent status) — a viewable attachment always has a url.
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
  const senderName = useResolvedSenderName(m.senderId);

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

        {/* Reply-to quote */}
        {m.replyTo && <ReplyQuote replyTo={m.replyTo} />}

        {/* Message text */}
        {m.text && (
          <p className="text-sm whitespace-pre-wrap">
            <MessageText text={m.text} />
          </p>
        )}

        {/* Attachment */}
        {m.attachment && (
          <div className="mt-2">
            <AttachmentView att={m.attachment} />
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
