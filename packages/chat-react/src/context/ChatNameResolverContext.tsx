'use client';

import * as React from 'react';
import type {
  ChatNameReadFailure,
  ChatNameResolution,
  ChatNameResolver,
  ChatPrewarmSenders,
} from '@ttt-productions/chat-core';

export type UnresolvedChatName = Exclude<ChatNameResolution, { status: 'resolved' }>;

type ChatNameResolverContextValue = {
  resolveName: ChatNameResolver;
  prewarm?: ChatPrewarmSenders;
  renderUnresolvedName?: (resolution: UnresolvedChatName) => React.ReactNode;
  renderHeldNameFailure?: (failure: ChatNameReadFailure) => React.ReactNode;
};

const ChatNameResolverContext = React.createContext<ChatNameResolverContextValue | null>(null);

export type ChatNameResolverProviderProps = {
  resolveName: ChatNameResolver;
  prewarm?: ChatPrewarmSenders;
  renderUnresolvedName?: (resolution: UnresolvedChatName) => React.ReactNode;
  renderHeldNameFailure?: (failure: ChatNameReadFailure) => React.ReactNode;
  children: React.ReactNode;
};

export function ChatNameResolverProvider(props: ChatNameResolverProviderProps) {
  const { resolveName, prewarm, renderUnresolvedName, renderHeldNameFailure, children } = props;
  const value = React.useMemo(
    () => ({ resolveName, prewarm, renderUnresolvedName, renderHeldNameFailure }),
    [resolveName, prewarm, renderUnresolvedName, renderHeldNameFailure],
  );
  return (
    <ChatNameResolverContext.Provider value={value}>{children}</ChatNameResolverContext.Provider>
  );
}

export function useChatNameResolver(): ChatNameResolverContextValue {
  const ctx = React.useContext(ChatNameResolverContext);
  if (!ctx) {
    throw new Error(
      '[chat-react] ChatNameResolverProvider is required. Wrap your ChatShell tree with <ChatNameResolverProvider>.',
    );
  }
  return ctx;
}

export function useOptionalChatNameResolver(): ChatNameResolverContextValue | null {
  return React.useContext(ChatNameResolverContext);
}

export function useSenderNameResolution(senderId: string): ChatNameResolution {
  const { resolveName } = useChatNameResolver();
  return resolveName(senderId);
}
