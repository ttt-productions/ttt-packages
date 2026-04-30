"use client";

import * as React from "react";
import type { ChatNameResolver, ChatPrewarmSenders } from "../types";

type ChatNameResolverContextValue = {
  resolveName: ChatNameResolver;
  prewarm?: ChatPrewarmSenders;
};

const ChatNameResolverContext = React.createContext<ChatNameResolverContextValue | null>(null);

export type ChatNameResolverProviderProps = {
  resolveName: ChatNameResolver;
  prewarm?: ChatPrewarmSenders;
  children: React.ReactNode;
};

/**
 * Wraps any chat-core consumer (typically the whole app shell) and provides
 * a name resolver. Required for any tree that renders <ChatShell>, <MessageList>,
 * or <MessageItemDefault>.
 */
export function ChatNameResolverProvider(props: ChatNameResolverProviderProps) {
  const { resolveName, prewarm, children } = props;
  const value = React.useMemo(() => ({ resolveName, prewarm }), [resolveName, prewarm]);
  return (
    <ChatNameResolverContext.Provider value={value}>
      {children}
    </ChatNameResolverContext.Provider>
  );
}

/**
 * Strict hook — throws if no provider is wrapped. Used inside chat-core's
 * own renderers (MessageItemDefault, ReplyQuote) so a missing setup surfaces
 * immediately on first render rather than silently rendering "User".
 */
export function useChatNameResolver(): ChatNameResolverContextValue {
  const ctx = React.useContext(ChatNameResolverContext);
  if (!ctx) {
    throw new Error(
      "[chat-core] ChatNameResolverProvider is required. Wrap your ChatShell tree with <ChatNameResolverProvider>."
    );
  }
  return ctx;
}

/**
 * Optional variant — returns null instead of throwing when no provider is
 * wrapped. Used internally by useChatMessages so headless callers (tests,
 * data-only consumers that don't render UI) can still use the hook.
 */
export function useOptionalChatNameResolver(): ChatNameResolverContextValue | null {
  return React.useContext(ChatNameResolverContext);
}

/**
 * Convenience hook for renderers. Returns a resolved string — never null —
 * by falling back to "User" when the cache hasn't filled yet. Re-renders
 * automatically once the upstream cache settles.
 */
export function useResolvedSenderName(senderId: string): string {
  const { resolveName } = useChatNameResolver();
  return resolveName(senderId) ?? "User";
}
