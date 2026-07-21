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
  CHAT_SEND_REJECTION_CODES,
  CHAT_SEND_REJECTION_RETRYABLE,
  ChatSendRejectedPayloadSchema,
  type ChannelRefTuple,
  type ChatGrantScope,
  type ChatSendRejectionCode,
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
      SEND_REJECTED: 'send-rejected',
    });
  });

  it('exports SEND_REJECTED exactly once from the canonical server-kind map', () => {
    expect(SERVER_KINDS.SEND_REJECTED).toBe('send-rejected');
    const occurrences = Object.values(SERVER_KINDS).filter((v) => v === 'send-rejected');
    expect(occurrences).toHaveLength(1);
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

describe('ChatSendRejectedPayloadSchema', () => {
  it('classifies every code as retryable or terminal (canonical table)', () => {
    expect(CHAT_SEND_REJECTION_CODES).toEqual([
      'membership-pending',
      'archived',
      'deleted',
      'wordlist-unavailable',
      'blocked-word',
      'flood',
      'slow-mode',
    ]);
    expect(CHAT_SEND_REJECTION_RETRYABLE).toEqual({
      'membership-pending': true,
      'wordlist-unavailable': true,
      'flood': true,
      'slow-mode': true,
      'archived': false,
      'deleted': false,
      'blocked-word': false,
    });
  });

  it('accepts each allowed code with its canonical retryability', () => {
    for (const code of CHAT_SEND_REJECTION_CODES) {
      const payload = {
        clientMessageId: 'c-1',
        code,
        retryable: CHAT_SEND_REJECTION_RETRYABLE[code],
      };
      const parsed = ChatSendRejectedPayloadSchema.parse(payload);
      expect(parsed.code).toBe(code);
      expect(parsed.retryable).toBe(CHAT_SEND_REJECTION_RETRYABLE[code]);
    }
  });

  it('accepts a valid optional retry hint on a retryable code', () => {
    const parsed = ChatSendRejectedPayloadSchema.parse({
      clientMessageId: 'c-1',
      code: 'flood',
      retryable: true,
      retryAfterMs: 2000,
    });
    expect(parsed.retryAfterMs).toBe(2000);
  });

  it('accepts an absent retry hint', () => {
    const parsed = ChatSendRejectedPayloadSchema.parse({
      clientMessageId: 'c-1',
      code: 'membership-pending',
      retryable: true,
    });
    expect(parsed.retryAfterMs).toBeUndefined();
  });

  it('rejects an empty clientMessageId', () => {
    expect(() =>
      ChatSendRejectedPayloadSchema.parse({ clientMessageId: '', code: 'flood', retryable: true }),
    ).toThrow();
  });

  it('rejects an oversized clientMessageId', () => {
    expect(() =>
      ChatSendRejectedPayloadSchema.parse({
        clientMessageId: 'x'.repeat(201),
        code: 'flood',
        retryable: true,
      }),
    ).toThrow();
  });

  it('rejects an unknown code', () => {
    expect(() =>
      ChatSendRejectedPayloadSchema.parse({
        clientMessageId: 'c-1',
        code: 'not-a-real-code' as ChatSendRejectionCode,
        retryable: true,
      }),
    ).toThrow();
  });

  it('rejects a retryability that disagrees with the canonical table', () => {
    // blocked-word is terminal — declaring it retryable must be rejected.
    expect(() =>
      ChatSendRejectedPayloadSchema.parse({
        clientMessageId: 'c-1',
        code: 'blocked-word',
        retryable: true,
      }),
    ).toThrow();
    // membership-pending is retryable — declaring it terminal must be rejected.
    expect(() =>
      ChatSendRejectedPayloadSchema.parse({
        clientMessageId: 'c-1',
        code: 'membership-pending',
        retryable: false,
      }),
    ).toThrow();
  });

  it('rejects an invalid retry hint (negative / non-integer)', () => {
    expect(() =>
      ChatSendRejectedPayloadSchema.parse({
        clientMessageId: 'c-1',
        code: 'flood',
        retryable: true,
        retryAfterMs: -1,
      }),
    ).toThrow();
    expect(() =>
      ChatSendRejectedPayloadSchema.parse({
        clientMessageId: 'c-1',
        code: 'flood',
        retryable: true,
        retryAfterMs: 12.5,
      }),
    ).toThrow();
  });
});
