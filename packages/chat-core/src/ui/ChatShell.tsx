"use client";

import * as React from "react";
import type {
  ChatCoreConfig,
  ChatAttachment,
  ChatAttachmentConfig,
  MessageRendererRegistry,
  ModerationHandlers,
} from "../types";
import { Card, CardHeader, CardContent, CardFooter, Skeleton } from "@ttt-productions/ui-core";
import { KeyboardAvoidingView } from "@ttt-productions/mobile-core";
import { useChatMessages } from "../hooks/useChatMessages";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { ThreadActions } from "./menus";

export type ChatShellProps = {
  config: ChatCoreConfig;

  // Header
  header?: React.ReactNode;

  // Send handler
  onSend: (text: string, attachment?: ChatAttachment) => void | Promise<void>;

  // Message rendering
  renderMessage?: (m: any) => React.ReactNode;
  messageRenderers?: MessageRendererRegistry;
  handlers?: ModerationHandlers;

  // Composer attachment config
  attachmentConfig?: ChatAttachmentConfig;
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
    composerPlaceholder,
    autoFocus = false,
    renderAboveMessages,
    renderBelowMessages,
    renderFooter,
    onSenderClick,
    composerDisabled,
  } = props;

  const { allowed, isInitialLoading, messages, fetchOlder, hasOlder, isFetchingOlder } =
    useChatMessages(config);

  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

  if (!allowed) {
    return <div className="p-4 text-sm opacity-70">You don&apos;t have access to this thread.</div>;
  }

  if (isInitialLoading) {
    return (
      <Card className="w-full">
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
    <Card className="w-full">
      {/* Header */}
      {(header || handlers) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>{header}</div>
          <div className="flex flex-col items-end gap-2">
            <ThreadActions threadId={config.threadId} isAdmin={config.isAdmin} handlers={handlers} />
          </div>
        </CardHeader>
      )}

      {/* Above messages slot */}
      {renderAboveMessages && (
        <div className="border-b">{renderAboveMessages()}</div>
      )}

      {/* Message list */}
      <CardContent className="p-0">
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
          handlers={handlers}
          onSenderClick={onSenderClick}
        />
      </CardContent>

      {/* Below messages slot */}
      {renderBelowMessages && (
        <div className="border-t">{renderBelowMessages()}</div>
      )}

      {/* Footer: custom footer OR Composer */}
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
              db={config.db}
              currentUserId={config.currentUserId}
              disabled={composerDisabled}
              autoFocus={autoFocus}
              placeholder={composerPlaceholder}
            />
          </KeyboardAvoidingView>
        </CardFooter>
      )}
    </Card>
  );
}
