"use client";

import * as React from "react";
import type { ChatCoreConfig, MessageRendererRegistry, ModerationHandlers } from "../types";
import { Card, CardHeader, CardContent, CardFooter, Skeleton } from "@ttt-productions/ui-core";
import { KeyboardAvoidingView } from "@ttt-productions/mobile-core";
import { useChatMessages } from "../hooks/useChatMessages";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { ThreadActions } from "./menus";

export function ChatShell(props: {
  config: ChatCoreConfig;

  header?: React.ReactNode;
  renderThreadActions?: () => React.ReactNode;

  onSend: (text: string) => void | Promise<void>;

  renderMessage?: (m: any) => React.ReactNode;
  messageRenderers?: MessageRendererRegistry;

  composerAutoFocus?: boolean;

  handlers?: ModerationHandlers;
}) {
  const {
    config,
    header,
    renderThreadActions,
    onSend,
    renderMessage,
    messageRenderers,
    composerAutoFocus = false,
    handlers
  } = props;

  const { allowed, isInitialLoading, messages, fetchOlder, hasOlder, isFetchingOlder } = useChatMessages(config);

  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

  if (!allowed) {
    return <div className="p-4 text-sm opacity-70">You don’t have access to this thread.</div>;
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
      {(header || renderThreadActions || handlers) && (
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>{header}</div>
          <div className="flex flex-col items-end gap-2">
            {renderThreadActions?.()}
            <ThreadActions threadId={config.threadId} isAdmin={config.isAdmin} handlers={handlers} />
          </div>
        </CardHeader>
      )}

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
        />
      </CardContent>

      <CardFooter className="border-t">
        <KeyboardAvoidingView padding offset={8} className="w-full">
          <Composer disabled={false} autoFocus={composerAutoFocus} onSend={onSend} />
        </KeyboardAvoidingView>
      </CardFooter>
    </Card>
  );
}
