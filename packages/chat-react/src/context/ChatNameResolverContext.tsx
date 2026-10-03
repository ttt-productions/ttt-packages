"use client";

import * as React from "react";
import type {
  ChatNameResolution,
  ChatNameResolver,
  ChatPrewarmSenders,
} from "@ttt-productions/chat-core";

/** A sender name the app could not resolve: pending, unavailable, or failed. */
export type UnresolvedChatName = Exclude<ChatNameResolution, { status: "resolved" }>;

type ChatNameResolverContextValue = {
  resolveName: ChatNameResolver;
  prewarm?: ChatPrewarmSenders;
  renderUnresolvedName?: (resolution: UnresolvedChatName) => React.ReactNode;
};

const ChatNameResolverContext = React.createContext<ChatNameResolverContextValue | null>(null);

export type ChatNameResolverProviderProps = {
  resolveName: ChatNameResolver;
  prewarm?: ChatPrewarmSenders;
  /**
   * Renders a sender whose name is not resolved — the app's own placeholder while the
   * read is pending, its unavailable state when there is no person to name, and its
   * load-error state (with `retry`) when the read failed. The chat UI never writes a
   * stand-in name of its own; without this slot an unresolved sender renders nothing.
   */
  renderUnresolvedName?: (resolution: UnresolvedChatName) => React.ReactNode;
  children: React.ReactNode;
};

/**
 * Wraps any chat-react consumer (typically the whole app shell) and provides the name
 * resolver. Required for any tree that renders <ChatShell>, <MessageList>, or
 * <MessageItemDefault>.
 */
export function ChatNameResolverProvider(props: ChatNameResolverProviderProps) {
  const { resolveName, prewarm, renderUnresolvedName, children } = props;
  const value = React.useMemo(
    () => ({ resolveName, prewarm, renderUnresolvedName }),
    [resolveName, prewarm, renderUnresolvedName],
  );
  return (
    <ChatNameResolverContext.Provider value={value}>
      {children}
    </ChatNameResolverContext.Provider>
  );
}

/**
 * Strict hook — throws if no provider is wrapped. Used inside this package's own
 * renderers so a missing setup surfaces on first render instead of rendering a sender
 * with no name.
 */
export function useChatNameResolver(): ChatNameResolverContextValue {
  const ctx = React.useContext(ChatNameResolverContext);
  if (!ctx) {
    throw new Error(
      "[chat-react] ChatNameResolverProvider is required. Wrap your ChatShell tree with <ChatNameResolverProvider>."
    );
  }
  return ctx;
}

/**
 * Optional variant — returns null instead of throwing when no provider is wrapped.
 * Used internally by the message hooks so headless callers (tests, data-only consumers
 * that render no UI) can still use them.
 */
export function useOptionalChatNameResolver(): ChatNameResolverContextValue | null {
  return React.useContext(ChatNameResolverContext);
}

/** What the app knows about a sender's name right now. Re-renders as the app's cache settles. */
export function useSenderNameResolution(senderId: string): ChatNameResolution {
  const { resolveName } = useChatNameResolver();
  return resolveName(senderId);
}
