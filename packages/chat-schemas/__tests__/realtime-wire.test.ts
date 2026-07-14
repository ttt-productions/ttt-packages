import { describe, it, expect } from 'vitest';
import {
  CHAT_SUBPROTOCOL,
  CHAT_WIRE_VERSION,
  CLIENT_KINDS,
  SERVER_KINDS,
  CHAT_CLOSE_CODES,
  ChannelRefTupleSchema,
  CHAT_GRANT_AUDIENCE,
  MODERATION_REDACTED_TEXT,
  HEARTBEAT_MS,
  TYPING_COALESCE_MS,
  HISTORY_PAGE_MAX,
  type ChannelRefTuple,
  type ChatGrantScope,
} from '../src/index.js';

describe('chat realtime wire contract — constants', () => {
  it('pins the subprotocol tag and wire version', () => {
    expect(CHAT_SUBPROTOCOL).toBe('ttt.chat.v1');
    expect(CHAT_WIRE_VERSION).toBe(1);
  });

  it('declares the exact client frame kinds', () => {
    expect(CLIENT_KINDS).toEqual({
      SEND: 'send',
      READ_ACK: 'read-ack',
      HISTORY: 'history',
      TYPING: 'typing',
      PRESENCE_SUBSCRIBE: 'presence-subscribe',
      PRESENCE_UNSUBSCRIBE: 'presence-unsubscribe',
      HEARTBEAT: 'heartbeat',
      RESUME: 'resume',
      MARK_READ: 'mark-read',
    });
  });

  it('declares the exact server frame kinds', () => {
    expect(SERVER_KINDS).toEqual({
      MESSAGE: 'message',
      ACK: 'ack',
      HISTORY_PAGE: 'history-page',
      PRESENCE: 'presence',
      TYPING: 'typing',
      UNREAD: 'unread',
      SNAPSHOT: 'snapshot',
      ERROR: 'error',
      REVISION: 'revision',
    });
  });

  it('declares the close-code map', () => {
    expect(CHAT_CLOSE_CODES).toEqual({
      AUTH_EXPIRED: 4401,
      REVOKED: 4403,
      FLOOD: 4408,
      TOO_LARGE: 4413,
      SOCKET_CAP: 4429,
      OVERLOADED: 1013,
    });
  });

  it('pins the grant audience and redacted text', () => {
    expect(CHAT_GRANT_AUDIENCE).toBe('ttt-chat');
    expect(MODERATION_REDACTED_TEXT).toBe('[message removed]');
  });

  it('pins the client-agreed limits', () => {
    expect(HEARTBEAT_MS).toBe(20_000);
    expect(TYPING_COALESCE_MS).toBe(2_000);
    expect(HISTORY_PAGE_MAX).toBe(50);
  });
});

describe('ChannelRefTupleSchema', () => {
  it('accepts a channel-scoped ref', () => {
    const ref: ChannelRefTuple = { scope: 'channel', workProjectId: 'wp1', guildChatChannelId: 'ch1' };
    expect(ChannelRefTupleSchema.parse(ref)).toEqual(ref);
  });

  it('accepts an invite-scoped ref', () => {
    const ref: ChannelRefTuple = { scope: 'invite', guildInviteId: 'inv1' };
    expect(ChannelRefTupleSchema.parse(ref)).toEqual(ref);
  });

  it('rejects an unknown scope', () => {
    expect(() => ChannelRefTupleSchema.parse({ scope: 'dm', a: 'x' })).toThrow();
  });

  it('rejects a channel ref missing a field', () => {
    expect(() => ChannelRefTupleSchema.parse({ scope: 'channel', workProjectId: 'wp1' })).toThrow();
  });
});

describe('ChatGrantScope type', () => {
  it('models the channel and inbox variants', () => {
    // Type-level assertion via assignability; runtime just confirms the shapes construct.
    const channelScope: ChatGrantScope = {
      kind: 'channel',
      channelRef: { scope: 'invite', guildInviteId: 'inv1' },
    };
    const inboxScope: ChatGrantScope = { kind: 'inbox', uid: 'u1' };
    expect(channelScope.kind).toBe('channel');
    expect(inboxScope.kind).toBe('inbox');
  });
});
