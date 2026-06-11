"use client";

import * as React from "react";
import type { ChatAttachment } from "@ttt-productions/chat-core";

/**
 * Resolves a READY chat attachment to a display URL at render time. The
 * attachment doc stores only `mediaAssetId` (never a URL); the consuming app
 * injects a resolver that builds the protected-gateway URL (or an emulator
 * URL) from `attachment.mediaAssetId` + its variant scheme. chat-react stays
 * app-agnostic — it never knows about gateways, hosts, or Firebase.
 *
 * Return null when no URL can be built yet (e.g. missing assetId) — the
 * renderer shows nothing for that attachment body.
 */
export type ChatAttachmentUrlResolver = (attachment: ChatAttachment) => string | null;

const ChatAttachmentUrlContext = React.createContext<ChatAttachmentUrlResolver | null>(null);

export type ChatAttachmentUrlProviderProps = {
  resolveAttachmentUrl: ChatAttachmentUrlResolver;
  children: React.ReactNode;
};

/**
 * Wraps any chat tree that renders attachments. Required alongside
 * <ChatNameResolverProvider> for trees rendering <ChatShell>/<MessageList>.
 */
export function ChatAttachmentUrlProvider(props: ChatAttachmentUrlProviderProps) {
  const { resolveAttachmentUrl, children } = props;
  return (
    <ChatAttachmentUrlContext.Provider value={resolveAttachmentUrl}>
      {children}
    </ChatAttachmentUrlContext.Provider>
  );
}

/** Strict hook — throws if no provider is wrapped (missing setup must surface). */
export function useChatAttachmentUrlResolver(): ChatAttachmentUrlResolver {
  const resolver = React.useContext(ChatAttachmentUrlContext);
  if (!resolver) {
    throw new Error(
      "[chat-react] ChatAttachmentUrlProvider is required. Wrap your ChatShell tree with <ChatAttachmentUrlProvider>."
    );
  }
  return resolver;
}
