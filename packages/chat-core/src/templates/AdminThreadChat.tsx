"use client";

import * as React from "react";
import type { ChatCoreConfig, ModerationHandlers } from "../types";
import { ChatShell } from "../ui/ChatShell";

export function AdminThreadChat(props: {
  config: ChatCoreConfig;
  onSend: (text: string) => void | Promise<void>;
  renderThreadActions?: () => React.ReactNode; // Close/Reopen/etc (app-owned)
  handlers?: ModerationHandlers;
}) {
  const { config, onSend, renderThreadActions, handlers } = props;
  return (
    <ChatShell
      config={config}
      header={<div className="font-medium">Support</div>}
      renderThreadActions={renderThreadActions}
      onSend={onSend}
      handlers={handlers}
    />
  );
}
