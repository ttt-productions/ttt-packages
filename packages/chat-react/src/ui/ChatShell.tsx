"use client";

import * as React from "react";
import type { ChatMessageV1, SendAttachmentFn, ModerationHandlers } from "@ttt-productions/chat-core";
import type {
  ChatCoreConfig,
  ChatAttachmentConfig,
  MessageRendererRegistry,
} from "../types.js";
import { Card, CardHeader, CardContent, CardFooter, Skeleton } from "@ttt-productions/ui-core/react";
import { KeyboardAvoidingView } from "@ttt-productions/mobile-core/react";
import { useChatMessages } from "../hooks/useChatMessages.js";
import { useRealtimeChatMessages } from "../realtime/useRealtimeChatMessages.js";
import type { RealtimeChatClient } from "../realtime/transport.js";
import { MessageList } from "./MessageList.js";
import { Composer } from "./Composer.js";
import { ThreadActions } from "./menus.js";

export type ChatShellProps = {
  config: ChatCoreConfig;

  // Header
  header?: React.ReactNode;

  // Send handler — text-only. On the realtime transport this is OPTIONAL: the
  // shell sends through the DO socket. If provided, it is still called (so a
  // consumer can mirror to analytics), but the socket send is authoritative.
  onSend?: (text: string, replyTo?: ChatMessageV1["replyTo"]) => Promise<void>;

  // Message rendering
  renderMessage?: (m: any) => React.ReactNode;
  messageRenderers?: MessageRendererRegistry;
  handlers?: ModerationHandlers;

  // Composer attachment config
  attachmentConfig?: ChatAttachmentConfig;
  sendAttachment?: SendAttachmentFn;
  composerPlaceholder?: string;
  autoFocus?: boolean;

  // Three render slots
  renderAboveMessages?: () => React.ReactNode;
  renderBelowMessages?: () => React.ReactNode;
  /** If provided, replaces the Composer entirely */
  renderFooter?: () => React.ReactNode;

  // Sender interaction
  onSenderClick?: (senderId: string, displayName: string) => void;

  // Disable
  composerDisabled?: boolean;

  /** Fill the parent's height instead of the default fixed-height card. Lays the Card out
   *  as `flex flex-col h-full` with the message list flexing to fill (scrolls inside), so a
   *  full-height page panel doesn't grow unbounded or waste space on a fixed 400px box.
   *  The consumer must give ChatShell a bounded-height parent (e.g. an `h-full` panel). */
  fillHeight?: boolean;
  /** Advanced override for the scrollable region's class (forwarded to MessageList).
   *  Usually unnecessary — prefer `fillHeight`. */
  scrollClassName?: string;
};

/** The resolved data a transport hook hands the presentational view. */
type ResolvedChat = {
  allowed: boolean;
  isInitialLoading: boolean;
  messages: ChatMessageV1[];
  fetchOlder: () => Promise<void>;
  hasOlder: boolean;
  isFetchingOlder: boolean;
  /** The send handler the Composer calls (socket send on realtime, prop on firestore). */
  send: (text: string, replyTo?: ChatMessageV1["replyTo"]) => Promise<void>;
  /** Advance the authoritative read cursor (realtime only; absent on the firestore path). */
  readAck?: (latestSeq: number, focused: boolean) => void;
};

/**
 * ChatShell dispatches on `config.transport`. Hooks must be unconditional, so the
 * two transports live in separate inner components (each calls exactly ONE data
 * hook) and both render the shared presentational `ChatShellView`. The default
 * (undefined / 'firestore') transport is byte-for-byte the previous behavior.
 */
export function ChatShell(props: ChatShellProps) {
  if (props.config.transport === "realtime") {
    return <RealtimeChatShell {...props} />;
  }
  return <FirestoreChatShell {...props} />;
}

function FirestoreChatShell(props: ChatShellProps) {
  const { config, onSend } = props;
  const r = useChatMessages(config);
  const send = React.useCallback(
    async (text: string, replyTo?: ChatMessageV1["replyTo"]) => {
      if (onSend) await onSend(text, replyTo);
    },
    [onSend],
  );
  return <ChatShellView {...props} resolved={{ ...r, send }} />;
}

function RealtimeChatShell(props: ChatShellProps) {
  const { config, onSend } = props;
  const client = config.realtime?.client as RealtimeChatClient | undefined;
  if (!client) {
    throw new Error(
      "[ChatShell] transport 'realtime' requires config.realtime.client (createRealtimeChatClient(...))",
    );
  }
  const r = useRealtimeChatMessages(client);
  const send = React.useCallback(
    async (text: string, replyTo?: ChatMessageV1["replyTo"]) => {
      // Map the UI replyTo (messageId-based) to the wire replyTo (seq + preview).
      const wireReply =
        replyTo && replyTo.messageId
          ? { messageSeq: Number(replyTo.messageId), preview: replyTo.messagePreview ?? "" }
          : null;
      const ok = r.send(text, Number.isFinite(wireReply?.messageSeq) ? wireReply : null);
      // C-B8: surface a closed-socket failure so the Composer keeps the user's text
      // instead of clearing it on a no-op send.
      if (!ok) throw new Error("chat-send-failed");
      if (onSend) await onSend(text, replyTo); // optional mirror
    },
    [r, onSend],
  );
  return (
    <ChatShellView
      {...props}
      resolved={{
        allowed: r.allowed,
        isInitialLoading: r.isInitialLoading,
        messages: r.messages,
        fetchOlder: r.fetchOlder,
        hasOlder: r.hasOlder,
        isFetchingOlder: r.isFetchingOlder,
        send,
        readAck: r.readAck,
      }}
    />
  );
}

function ChatShellView(props: ChatShellProps & { resolved: ResolvedChat }) {
  const {
    config,
    header,
    renderMessage,
    messageRenderers,
    handlers,
    attachmentConfig,
    sendAttachment,
    composerPlaceholder,
    autoFocus = false,
    renderAboveMessages,
    renderBelowMessages,
    renderFooter,
    onSenderClick,
    composerDisabled,
    fillHeight = false,
    scrollClassName,
    resolved,
  } = props;

  const { allowed, isInitialLoading, messages, fetchOlder, hasOlder, isFetchingOlder, send, readAck } = resolved;

  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);
  const [focused, setFocused] = React.useState(true);
  const lastAckedRef = React.useRef(0);
  const leaseHeldRef = React.useRef(false);

  // The latest authoritative seq currently rendered (optimistic rows have no seq).
  const latestSeq = React.useMemo(() => {
    let max = 0;
    for (const m of messages) {
      const seq = typeof m.meta?.seq === "number" ? (m.meta?.seq as number) : 0;
      if (seq > max) max = seq;
    }
    return max;
  }, [messages]);

  // Track tab focus/visibility so the read-ack "focused" lease releases on blur/hide.
  React.useEffect(() => {
    const compute = () =>
      typeof document === "undefined" ||
      (document.visibilityState !== "hidden" && (typeof document.hasFocus !== "function" || document.hasFocus()));
    setFocused(compute());
    const onChange = () => setFocused(compute());
    window.addEventListener("focus", onChange);
    window.addEventListener("blur", onChange);
    document.addEventListener("visibilitychange", onChange);
    return () => {
      window.removeEventListener("focus", onChange);
      window.removeEventListener("blur", onChange);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, []);

  // C-B6: advance the authoritative read cursor when the reader is actually at the
  // latest message (channel mounted + tab focused + scrolled to bottom); release the
  // focus lease exactly once when they stop. No-op on the firestore path (no readAck).
  React.useEffect(() => {
    if (!readAck || latestSeq <= 0) return;
    if (focused && atBottom) {
      leaseHeldRef.current = true;
      if (latestSeq > lastAckedRef.current) {
        lastAckedRef.current = latestSeq;
        readAck(latestSeq, true);
      }
    } else if (leaseHeldRef.current) {
      leaseHeldRef.current = false;
      readAck(latestSeq, false);
    }
  }, [readAck, latestSeq, atBottom, focused]);

  // In fill mode the Card flexes to its parent's height and the message list fills the
  // space between header and composer; otherwise it's the default natural-height card.
  const cardClassName = fillHeight ? "w-full flex flex-col h-full min-h-0" : "w-full";
  const contentClassName = fillHeight ? "p-0 flex-1 min-h-0 flex flex-col" : "p-0";

  if (!allowed) {
    return <div className="p-4 text-sm opacity-70">You don&apos;t have access to this thread.</div>;
  }

  if (isInitialLoading) {
    return (
      <Card className={cardClassName}>
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[240px] w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className={cardClassName}>
      {(header || handlers) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>{header}</div>
          <div className="flex flex-col items-end gap-2">
            <ThreadActions threadId={config.threadId} isAdmin={config.isAdmin} handlers={handlers} />
          </div>
        </CardHeader>
      )}

      {renderAboveMessages && (
        <div className="border-b">{renderAboveMessages()}</div>
      )}

      <CardContent className={contentClassName}>
        <MessageList
          messages={messages}
          currentUserId={config.currentUserId}
          isAdmin={config.isAdmin}
          isFetchingOlder={isFetchingOlder}
          hasOlder={hasOlder}
          onLoadOlder={() => fetchOlder()}
          renderMessage={renderMessage}
          messageRenderers={messageRenderers}
          showScrollToBottom={showScrollToBottom}
          onScrollToBottom={() => setShowScrollToBottom(false)}
          onAtBottomChange={setAtBottom}
          fillHeight={fillHeight}
          scrollClassName={scrollClassName}
          handlers={handlers}
          onSenderClick={onSenderClick}
        />
      </CardContent>

      {renderBelowMessages && (
        <div className="border-t">{renderBelowMessages()}</div>
      )}

      {renderFooter ? (
        <CardFooter className="border-t">
          {renderFooter()}
        </CardFooter>
      ) : (
        <CardFooter className="border-t">
          <KeyboardAvoidingView padding offset={8} className="w-full">
            <Composer
              onSend={send}
              attachmentConfig={attachmentConfig}
              sendAttachment={sendAttachment}
              disabled={composerDisabled}
              autoFocus={autoFocus}
              placeholder={composerPlaceholder}
              mentionConfig={config.mentionConfig}
            />
          </KeyboardAvoidingView>
        </CardFooter>
      )}
    </Card>
  );
}
