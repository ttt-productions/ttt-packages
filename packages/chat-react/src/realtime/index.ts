// The realtime (Cloudflare Durable Object) chat transport — the client half of
// the chat Worker wire protocol (Contract A connection + Contract C wire). The
// FIRESTORE transport stays the unchanged default; this is opt-in via
// `ChatCoreConfig.transport === 'realtime'` + a `realtime.client` from
// `createRealtimeChatClient(...)`.

export {
  CHAT_SUBPROTOCOL,
  CHAT_WIRE_VERSION,
  CHAT_CLOSE_CODES,
  CLIENT_FRAME,
  SERVER_FRAME,
  buildFrame,
  parseFrame,
  isInboxSnapshot,
} from './wire.js';
export type {
  ChannelRefTuple,
  ChatCloseCode,
  WireMessageRow,
  WireChannelSnapshot,
  WireInboxSnapshot,
  WireRegistryEntry,
  ServerFrame,
  RevisionKind,
} from './wire.js';

export type { RealtimeSocket, SocketFactory, SocketHandlers } from './socket.js';
export { browserSocketFactory } from './socket.js';

export type { GrantProvider, TransportTimers, RealtimeStatus } from './shared.js';
export { defaultTimers, HEARTBEAT_MS, TYPING_COALESCE_MS, HISTORY_PAGE_MAX } from './shared.js';

export {
  wireRowToMessage,
  optimisticMessage,
  seqToMessageId,
  applyModerationOverlay,
  overlayFromRow,
  MODERATION_REDACTED_TEXT,
} from './map.js';
export type { ModerationOverlay } from './map.js';

export { ChannelClient } from './channel-client.js';
export type { ChannelClientState, ChannelClientConfig } from './channel-client.js';
export { InboxClient } from './inbox-client.js';
export type { InboxClientState, InboxClientConfig } from './inbox-client.js';

export {
  createRealtimeChatClient,
  createInboxClient,
} from './transport.js';
export type { RealtimeChatClient, RealtimeTransportConfig } from './transport.js';

export { useRealtimeChatMessages } from './useRealtimeChatMessages.js';
export type { UseRealtimeChatMessagesResult } from './useRealtimeChatMessages.js';
