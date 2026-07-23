"use client";

import type { ChatMessageV1, ChatAttachment, ModerationHandlers } from "@ttt-productions/chat-core";
import { MessageText } from "../mentions/MessageText.js";
import { cn } from "@ttt-productions/ui-core";
import { Button } from "@ttt-productions/ui-core/react";
import { MediaViewer } from "@ttt-productions/media-viewer/react";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import { MessageActions } from "./menus.js";
import { useResolvedSenderName } from "../context/ChatNameResolverContext.js";
import { useChatAttachmentUrlResolver } from "../context/ChatAttachmentUrlContext.js";
import { useChatAttachmentMediaComponent } from "../context/ChatAttachmentMediaContext.js";

// ============================================
// Attachment rendering
// ============================================

function getAttachmentLabel(type: ChatAttachment["type"]): string {
  switch (type) {
    case "image": return "Image attachment";
    case "video": return "Video attachment";
    case "audio": return "Audio attachment";
    default: return "File attachment";
  }
}

// Safe, generic terminal-failure copy per kind. The backend `failureReason` is an
// INTERNAL diagnostic string and must never reach the UI (it could leak processing
// internals); it is mapped to this fixed copy instead.
function getAttachmentFailureCopy(type: ChatAttachment["type"]): string {
  switch (type) {
    case "image": return "This image could not be processed.";
    case "video": return "This video could not be processed.";
    case "audio": return "This audio could not be processed.";
    default: return "This file could not be processed.";
  }
}

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

function AttachmentView({
  att,
  mine,
  onRetryAttachment,
}: {
  att: ChatAttachment;
  mine: boolean;
  onRetryAttachment?: () => void;
}) {
  // Display URL is built at render time by the app-injected resolver from
  // att.mediaAssetId — attachments never store URLs (protected-gateway model).
  const resolveAttachmentUrl = useChatAttachmentUrlResolver();
  // App-injected media component (optional) — lets chat attachments ride the
  // app's ONE display path (recovery adapter, diagnostics, telemetry). Falls
  // back to the package's own MediaViewer when no provider is present.
  const Media = useChatAttachmentMediaComponent() ?? MediaViewer;
  // In-flight placeholder — bytes uploaded, backend processing/moderation pending.
  // No `mediaAssetId` yet. Rendered only to the sender (other participants can't
  // read a pending doc — Firestore rules scope it until `status === 'ready'`). The
  // bytes are already uploaded, so the honest copy is "Processing…" (NOT "Sending…").
  if (att.status === "pending") {
    return (
      <div className="chat-attachment-pending" role="status" aria-live="polite">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="truncate">{getAttachmentLabel(att.type)}</span>
        <span className="chat-attachment-status-label">Processing…</span>
      </div>
    );
  }
  // Processing/moderation rejected the attachment — sender-only. The backend
  // `failureReason` is internal and NEVER rendered; a fixed safe per-kind copy is
  // shown instead. The sender can pick a fresh file through the canonical picker
  // ("Attach again"), offered only when the composer wired a retry handler.
  if (att.status === "failed") {
    return (
      <div className="chat-attachment-rejected" role="alert">
        <AlertTriangle className="h-4 w-4 shrink-0 chat-attachment-rejected-icon" />
        <div className="chat-attachment-rejected-body">
          <span className="truncate">{getAttachmentLabel(att.type)}</span>
          <span className="chat-attachment-rejected-reason">
            {getAttachmentFailureCopy(att.type)}
          </span>
        </div>
        {mine && onRetryAttachment && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="chat-attachment-retry"
            onClick={onRetryAttachment}
          >
            Attach again
          </Button>
        )}
      </div>
    );
  }
  // ready (or legacy/absent status) — resolve the display URL from the asset ref.
  const url = resolveAttachmentUrl(att);
  if (!url) {
    // Terminal-ready row, but the authorized URL is still SETTLING (the grant/URL
    // resolver has nothing yet). Returning null left only the surrounding message
    // metadata → an observed empty bubble; a broken/grant-less <img> would flash a
    // 403. Render a neutral loading placeholder in the existing loading visual
    // language (spinner + kind-appropriate generic label + "Loading…", never
    // "Sending…", NO filename) and do NOT mount the media/download renderer until a
    // non-empty authorized URL exists. Sender-only pending/processing/failed states
    // above are unchanged — this begins only after a terminal-ready row is received.
    return (
      <div className="chat-attachment-pending" role="status" aria-live="polite">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="truncate">{getAttachmentLabel(att.type)}</span>
        <span className="chat-attachment-status-label">Loading…</span>
      </div>
    );
  }
  if (att.type === "image") {
    return <Media type="image" url={url} alt="Image attachment" className="chat-attachment-media" />;
  }
  if (att.type === "video") {
    return <Media type="video" url={url} controls className="chat-attachment-media" />;
  }
  if (att.type === "audio") {
    return <Media type="audio" url={url} controls className="chat-attachment-media" />;
  }
  // text/markdown — download link
  return (
    <a
      href={url}
      download={att.name}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-attachment-text-link"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">Download attachment</span>
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

  /** Retry a failed realtime send by its original clientMessageId (wired by
   *  ChatShell on the realtime transport; absent on firestore). Enables the
   *  retry affordance on a `meta.sendFailed` bubble. */
  onRetrySend?: (clientMessageId: string) => void;

  /** Re-open the attachment picker for a terminally-failed attachment (wired by
   *  ChatShell to the Composer's `openAttachmentSelector`; present only when
   *  attachment support is configured). Enables the "Attach again" action on a
   *  failed attachment bubble, shown only to the sender. */
  onRetryAttachment?: () => void;

};

export function MessageItemDefault(props: MessageItemDefaultProps) {
  const { m, currentUserId, isAdmin, handlers, isContinuation, onSenderClick, onRetrySend, onRetryAttachment } = props;
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

        {m.attachment && (
          <div className="mt-2">
            <AttachmentView att={m.attachment} mine={mine} onRetryAttachment={onRetryAttachment} />
          </div>
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
