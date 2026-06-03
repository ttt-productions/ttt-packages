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
import { MessageList } from "./MessageList.js";
import { Composer } from "./Composer.js";
import { ThreadActions } from "./menus.js";

export type ChatShellProps = {
  config: ChatCoreConfig;

  // Header
  header?: React.ReactNode;

  // Send handler — text-only
  onSend: (text: string, replyTo?: ChatMessageV1["replyTo"]) => Promise<void>;

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

export function ChatShell(props: ChatShellProps) {
  const {
    config,
    header,
    onSend,
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
  } = props;

  const { allowed, isInitialLoading, messages, fetchOlder, hasOlder, isFetchingOlder } =
    useChatMessages(config);

  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

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
              onSend={onSend}
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
