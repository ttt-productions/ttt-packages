"use client";

import * as React from "react";
import type { ChatCoreConfig, MessageRendererRegistry, ModerationHandlers } from "../types";
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
  const listOuterRef = React.useRef<HTMLDivElement>(null);

  if (!allowed) {
    return <div className="p-4 text-sm opacity-70">You don’t have access to this thread.</div>;
  }

  if (isInitialLoading) {
    return <div className="p-6 flex items-center justify-center text-sm opacity-70">Loading chat…</div>;
  }

  return (
    <div className="w-full border rounded-lg overflow-hidden">
      {(header || renderThreadActions || handlers) && (
        <div className="p-4 border-b flex items-start justify-between gap-4">
          <div>{header}</div>
          <div className="flex flex-col items-end gap-2">
            {renderThreadActions?.()}
            <ThreadActions threadId={config.threadId} isAdmin={config.isAdmin} handlers={handlers} />
          </div>
        </div>
      )}

      <div ref={listOuterRef}>
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
      </div>

      <div className="p-4 border-t">
        <Composer
          disabled={false}
          autoFocus={composerAutoFocus}
          onSend={onSend}
        />
      </div>
    </div>
  );
}
