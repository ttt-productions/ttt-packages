"use client";

import * as React from "react";
import type { ChatCoreConfig, ModerationHandlers, MessageRendererRegistry } from "../types";
import { ChatShell } from "../ui/ChatShell";

export function ChannelChat(props: {
  config: ChatCoreConfig;
  title?: string;
  onSend: (text: string) => void | Promise<void>;
  renderMessage?: (m: any) => React.ReactNode;
  messageRenderers?: MessageRendererRegistry;
  handlers?: ModerationHandlers;
}) {
  const { config, title, onSend, renderMessage, messageRenderers, handlers } = props;
  return (
    <ChatShell
      config={config}
      header={<div className="font-medium">{title ?? "Channel"}</div>}
      onSend={onSend}
      renderMessage={renderMessage}
      messageRenderers={messageRenderers}
      handlers={handlers}
    />
  );
}
