import type { ReactNode } from 'react';
import type { ChatMessageV1 } from '@ttt-productions/chat-core';
import type { ChatConversationRef } from '@ttt-productions/chat-schemas';

export type ChatTransportMode = 'firestore' | 'realtime';

export interface ChatRealtimeTransportConfig {
  channelRef: ChatConversationRef;
  client: unknown;
}

export type ChatCoreConfig = {
  chatCollectionPath: string | string[];
  messagesSubcollection?: string;
  threadId: string;
  currentUserId: string;
  currentUserDisplayName?: string;
  transport?: ChatTransportMode;
  realtime?: ChatRealtimeTransportConfig;
  allowed: boolean;
  createdAtField?: string;
  pageSize?: number;
  messageMeta?: (doc: Record<string, unknown>) => Record<string, unknown> | undefined;
};

export type MessageRenderer = (m: ChatMessageV1) => ReactNode;

export type MessageRendererRegistry = Record<string, MessageRenderer>;
