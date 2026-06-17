// The realtime transport HANDLE the chat-react config carries on the `realtime`
// transport (`ChatRealtimeTransportConfig.client`). It owns:
//   - a ChannelClient for the active thread (send/read/typing/presence/history)
//   - the grant-mint wiring (channel scope) via the injected grantProvider
//   - auth-user-switch teardown (close every socket before connecting as a new uid)
//
// The INBOX socket is created SEPARATELY (one per user, app-wide) via
// `createInboxClient` — it is not tied to a single thread, so the app owns its
// lifetime (mount it once at the dock, not per ChatShell). This keeps the channel
// transport (per-thread) and the inbox transport (per-user) cleanly split, exactly
// as the worker splits Channel DOs from the Inbox DO.

import { ChannelClient, type ChannelClientConfig, type ChannelClientState } from './channel-client.js';
import { InboxClient, type InboxClientConfig, type InboxClientState } from './inbox-client.js';
import { browserSocketFactory, type SocketFactory } from './socket.js';
import type { GrantProvider, TransportTimers } from './shared.js';
import type { ChannelRefTuple } from './wire.js';

/**
 * Everything the channel transport needs. The app supplies `grantProvider`
 * (its `mintChatGrant` callable, channel scope) + `endpoint`; `socketFactory`
 * defaults to the real browser WebSocket and is overridden in tests.
 */
export interface RealtimeTransportConfig {
  endpoint: string;
  channelRef: ChannelRefTuple;
  threadId: string;
  currentUserId: string;
  grantProvider: GrantProvider;
  socketFactory?: SocketFactory;
  timers?: TransportTimers;
  reconnect?: ChannelClientConfig['reconnect'];
}

/**
 * The opaque realtime client handle stored on `ChatRealtimeTransportConfig.client`.
 * The UI hook (`useRealtimeChatMessages`) drives it; the UI never reaches into the
 * socket directly.
 */
export interface RealtimeChatClient {
  readonly channel: ChannelClient;
  readonly channelRef: ChannelRefTuple;
  readonly currentUserId: string;
  connect(): Promise<void>;
  /** Tear down every socket (auth-user switch / unmount). Idempotent. */
  close(): void;
  getState(): ChannelClientState;
  subscribe(fn: (s: ChannelClientState) => void): () => void;
}

/** Create the per-thread realtime client (the value placed on `config.realtime.client`). */
export function createRealtimeChatClient(config: RealtimeTransportConfig): RealtimeChatClient {
  const channel = new ChannelClient({
    endpoint: config.endpoint,
    threadId: config.threadId,
    currentUserId: config.currentUserId,
    grantProvider: config.grantProvider,
    socketFactory: config.socketFactory ?? browserSocketFactory,
    timers: config.timers,
    reconnect: config.reconnect,
  });

  return {
    channel,
    channelRef: config.channelRef,
    currentUserId: config.currentUserId,
    connect: () => channel.connect(),
    close: () => channel.close(),
    getState: () => channel.getState(),
    subscribe: (fn) => channel.subscribe(fn),
  };
}

/** Create the per-USER inbox client (mount once at the dock; not per-thread). */
export function createInboxClient(config: {
  endpoint: string;
  currentUserId: string;
  grantProvider: GrantProvider;
  socketFactory?: SocketFactory;
  timers?: TransportTimers;
  reconnect?: InboxClientConfig['reconnect'];
}): InboxClient {
  return new InboxClient({
    endpoint: config.endpoint,
    currentUserId: config.currentUserId,
    grantProvider: config.grantProvider,
    socketFactory: config.socketFactory ?? browserSocketFactory,
    timers: config.timers,
    reconnect: config.reconnect,
  });
}

export type { ChannelClientState, InboxClientState };
