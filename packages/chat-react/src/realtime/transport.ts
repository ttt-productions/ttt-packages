import {
  ChannelClient,
  type ChannelClientConfig,
  type ChannelClientState,
} from './channel-client.js';
import { InboxClient, type InboxClientConfig } from './inbox-client.js';
import { browserSocketFactory, type SocketFactory } from './socket.js';
import type { GrantProvider, InboxGrantProvider, TransportTimers } from './shared.js';
import type { ChatClientDiagnosticsOption } from './diagnostics.js';
import type { ChatConversationRef } from '@ttt-productions/chat-schemas';

export interface RealtimeTransportConfig {
  endpoint: string;
  channelRef: ChatConversationRef;
  threadId: string;
  currentUserId: string;
  grantProvider: GrantProvider;
  socketFactory?: SocketFactory;
  timers?: TransportTimers;
  reconnect?: ChannelClientConfig['reconnect'];
  diagnostics?: ChatClientDiagnosticsOption;
}

export interface RealtimeChatClient {
  readonly channel: ChannelClient;
  readonly channelRef: ChatConversationRef;
  readonly currentUserId: string;
  connect(): Promise<void>;
  retry(): void;
  close(): void;
  getState(): ChannelClientState;
  subscribe(fn: (s: ChannelClientState) => void): () => void;
}

export function createRealtimeChatClient(config: RealtimeTransportConfig): RealtimeChatClient {
  const channel = new ChannelClient({
    endpoint: config.endpoint,
    threadId: config.threadId,
    currentUserId: config.currentUserId,
    grantProvider: config.grantProvider,
    socketFactory: config.socketFactory ?? browserSocketFactory,
    timers: config.timers,
    reconnect: config.reconnect,
    diagnostics: config.diagnostics,
  });

  return {
    channel,
    channelRef: config.channelRef,
    currentUserId: config.currentUserId,
    connect: () => channel.connect(),
    retry: () => channel.retryNow(),
    close: () => channel.close(),
    getState: () => channel.getState(),
    subscribe: (fn) => channel.subscribe(fn),
  };
}

export function createInboxClient(config: {
  endpoint: string;
  currentUserId: string;
  grantProvider: InboxGrantProvider;
  socketFactory?: SocketFactory;
  timers?: TransportTimers;
  reconnect?: InboxClientConfig['reconnect'];
  diagnostics?: ChatClientDiagnosticsOption;
}): InboxClient {
  return new InboxClient({
    endpoint: config.endpoint,
    currentUserId: config.currentUserId,
    grantProvider: config.grantProvider,
    socketFactory: config.socketFactory ?? browserSocketFactory,
    timers: config.timers,
    reconnect: config.reconnect,
    diagnostics: config.diagnostics,
  });
}
