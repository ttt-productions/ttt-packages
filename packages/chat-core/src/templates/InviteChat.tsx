"use client";

import * as React from "react";
import type { ChatCoreConfig, ModerationHandlers } from "../types";
import { ChatShell } from "../ui/ChatShell";

export function InviteChat(props: {
  config: ChatCoreConfig;
  onSend: (text: string) => void | Promise<void>;
  renderThreadActions?: () => React.ReactNode; // Accept/Decline/Finalize (app-owned)
  handlers?: ModerationHandlers;
}) {
  const { config, onSend, renderThreadActions, handlers } = props;
  return (
    <ChatShell
      config={config}
      header={<div className="font-medium">Invite</div>}
      renderThreadActions={renderThreadActions}
      onSend={onSend}
      handlers={handlers}
    />
  );
}
