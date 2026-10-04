import { describe, it, expect } from 'vitest';
import {
  CHAT_SUBPROTOCOL,
  CHAT_WIRE_VERSION,
  CLIENT_KINDS,
  SERVER_KINDS,
  CHAT_CLOSE_CODES,
  ChatConversationRefSchema,
  ChatGrantScopeSchema,
  ChatGrantClaimsSchema,
  CHAT_CONVERSATION_KIND_MAX_LENGTH,
  CHAT_CONVERSATION_ID_MAX_LENGTH,
  CHAT_MESSAGE_TEXT_MAX_LENGTH,
  CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH,
  ChatClientMessageIdSchema,
  ChatMarkReadPayloadSchema,
  ChatMarkReadResultPayloadSchema,
  CHAT_MARK_READ_FAILURE_CODES,
  CHAT_GRANT_AUDIENCE,
  MODERATION_REDACTED_TEXT,
  HEARTBEAT_MS,
  TYPING_COALESCE_MS,
  HISTORY_PAGE_MAX,
  CHAT_SEND_REJECTION_CODES,
  CHAT_SEND_REJECTION_RETRYABLE,
  ChatSendRejectedPayloadSchema,
  type ChatConversationRef,
  type ChatGrantScope,
  type ChatSendRejectionCode,
} from '../src/index.js';
import * as chatSchemas from '../src/index.js';

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
      HEARTBEAT_ACK: 'heartbeat-ack',
      MARK_READ_RESULT: 'mark-read-result',
    });
  });

  it('declares the heartbeat auto-response kind (client heartbeat is fire-and-forget)', () => {
    // The DO runtime answers CLIENT_KINDS.HEARTBEAT with this frame without waking
    // the DO; every runtime derives the literal from here rather than restating it.
    expect(SERVER_KINDS.HEARTBEAT_ACK).toBe(`${CLIENT_KINDS.HEARTBEAT}-ack`);
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

describe('ChatConversationRefSchema — a conversation is a neutral kind plus an id', () => {
  it('accepts an app-chosen kind and an opaque id, including a composite id with separators', () => {
    const ref: ChatConversationRef = { kind: 'teamRoom', id: 'org-1/room:7' };
    expect(ChatConversationRefSchema.parse(ref)).toEqual(ref);
  });

  it('refuses a kind that could hold a separator, so a kind can never bleed into an id', () => {
    for (const kind of ['team:room', 'team/room', 'Team', '1team', '', 'team room']) {
      expect(ChatConversationRefSchema.safeParse({ kind, id: 'x' }).success).toBe(false);
    }
  });

  it('bounds the kind and the id', () => {
    expect(ChatConversationRefSchema.safeParse({ kind: 'k'.repeat(CHAT_CONVERSATION_KIND_MAX_LENGTH), id: 'x' }).success).toBe(true);
    expect(ChatConversationRefSchema.safeParse({ kind: 'k'.repeat(CHAT_CONVERSATION_KIND_MAX_LENGTH + 1), id: 'x' }).success).toBe(false);
    expect(ChatConversationRefSchema.safeParse({ kind: 'room', id: 'i'.repeat(CHAT_CONVERSATION_ID_MAX_LENGTH) }).success).toBe(true);
    expect(ChatConversationRefSchema.safeParse({ kind: 'room', id: 'i'.repeat(CHAT_CONVERSATION_ID_MAX_LENGTH + 1) }).success).toBe(false);
  });

  it('refuses an empty id and an id holding a control character', () => {
    expect(ChatConversationRefSchema.safeParse({ kind: 'room', id: '' }).success).toBe(false);
    for (const code of [0x00, 0x0a, 0x1f, 0x7f]) {
      const id = `a${String.fromCharCode(code)}b`;
      expect(ChatConversationRefSchema.safeParse({ kind: 'room', id }).success).toBe(false);
    }
  });

  it('refuses any field beyond kind and id — no app business field rides the ref', () => {
    expect(ChatConversationRefSchema.safeParse({ kind: 'room', id: 'x', workProjectId: 'w' }).success).toBe(false);
  });
});

describe('ChatGrantScopeSchema', () => {
  it('parses a channel grant naming one conversation and an inbox grant naming its uid', () => {
    const channelScope: ChatGrantScope = { kind: 'channel', channelRef: { kind: 'room', id: 'r1' } };
    const inboxScope: ChatGrantScope = { kind: 'inbox', uid: 'u1' };
    expect(ChatGrantScopeSchema.parse(channelScope)).toEqual(channelScope);
    expect(ChatGrantScopeSchema.parse(inboxScope)).toEqual(inboxScope);
  });

  it('refuses a channel grant whose conversation ref is malformed', () => {
    expect(ChatGrantScopeSchema.safeParse({ kind: 'channel', channelRef: { scope: 'invite', guildInviteId: 'i1' } }).success).toBe(false);
    expect(ChatGrantScopeSchema.safeParse({ kind: 'channel', channelRef: { kind: 'room', id: '' } }).success).toBe(false);
  });

  it('refuses an unknown scope kind and an inbox grant without a uid', () => {
    expect(ChatGrantScopeSchema.safeParse({ kind: 'admin', uid: 'u1' }).success).toBe(false);
    expect(ChatGrantScopeSchema.safeParse({ kind: 'inbox', uid: '' }).success).toBe(false);
  });
});

describe('the send bounds', () => {
  it('one text bound for every send path: 4000 UTF-16 code units', () => {
    expect(CHAT_MESSAGE_TEXT_MAX_LENGTH).toBe(4000);
  });

  it('a client message id is non-empty and bounded', () => {
    expect(ChatClientMessageIdSchema.safeParse('c'.repeat(CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH)).success).toBe(true);
    expect(ChatClientMessageIdSchema.safeParse('c'.repeat(CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH + 1)).success).toBe(false);
    expect(ChatClientMessageIdSchema.safeParse('').success).toBe(false);
  });
});

describe('the mark-read command and its correlated result', () => {
  it('a mark-read names the entry and the request its result will name', () => {
    expect(ChatMarkReadPayloadSchema.parse({ channelRef: 'abc', requestId: 'r-1' })).toEqual({ channelRef: 'abc', requestId: 'r-1' });
    expect(ChatMarkReadPayloadSchema.safeParse({ channelRef: 'abc' }).success).toBe(false);
    expect(ChatMarkReadPayloadSchema.safeParse({ channelRef: '', requestId: 'r-1' }).success).toBe(false);
  });

  it('a success result names its request', () => {
    expect(ChatMarkReadResultPayloadSchema.parse({ requestId: 'r-1', ok: true })).toEqual({ requestId: 'r-1', ok: true });
  });

  it('a failure result names its request and one of the declared reasons', () => {
    for (const code of CHAT_MARK_READ_FAILURE_CODES) {
      expect(ChatMarkReadResultPayloadSchema.parse({ requestId: 'r-1', ok: false, code })).toEqual({ requestId: 'r-1', ok: false, code });
    }
    expect(ChatMarkReadResultPayloadSchema.safeParse({ requestId: 'r-1', ok: false, code: 'nope' }).success).toBe(false);
    expect(ChatMarkReadResultPayloadSchema.safeParse({ requestId: 'r-1', ok: false }).success).toBe(false);
  });

  it('a result without a request id is not a result', () => {
    expect(ChatMarkReadResultPayloadSchema.safeParse({ ok: true }).success).toBe(false);
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
      'too-long',
    ]);
    expect(CHAT_SEND_REJECTION_RETRYABLE).toEqual({
      'membership-pending': true,
      'wordlist-unavailable': true,
      'flood': true,
      'slow-mode': true,
      'archived': false,
      'deleted': false,
      'blocked-word': false,
      'too-long': false,
    });
  });

  it('an over-bound text is a terminal rejection — the same text can never be accepted', () => {
    expect(CHAT_SEND_REJECTION_RETRYABLE['too-long']).toBe(false);
    expect(
      ChatSendRejectedPayloadSchema.safeParse({ clientMessageId: 'c-1', code: 'too-long', retryable: true }).success,
    ).toBe(false);
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

describe('ChatGrantClaimsSchema — what the signer signs is exactly what the verifier accepts', () => {
  const claims = {
    v: 1,
    typ: 'grant',
    aud: 'ttt-chat',
    env: 'dev',
    uid: 'u1',
    scope: { kind: 'channel', channelRef: { kind: 'room', id: 'r1' } },
    iat: 1000,
    exp: 1900,
  };

  it('accepts a well-formed channel or inbox grant payload', () => {
    expect(ChatGrantClaimsSchema.parse(claims)).toEqual(claims);
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, scope: { kind: 'inbox', uid: 'u1' } }).success).toBe(true);
  });

  it('refuses a payload for another audience, version, or token type', () => {
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, aud: 'ttt-media' }).success).toBe(false);
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, v: 2 }).success).toBe(false);
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, typ: 'session' }).success).toBe(false);
  });

  it('refuses a missing or malformed identity, scope, or time', () => {
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, uid: '' }).success).toBe(false);
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, scope: { kind: 'channel', channelRef: { scope: 'invite' } } }).success).toBe(false);
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, iat: Number.NaN }).success).toBe(false);
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, exp: 1000 }).success).toBe(false);
  });

  it('refuses any claim beyond the declared ones', () => {
    expect(ChatGrantClaimsSchema.safeParse({ ...claims, adm: 1 }).success).toBe(false);
  });
});

describe('the channel socket client frame payloads', () => {
  it('a send carries a parsed id and its text; the length is judged after the parse', () => {
    const longText = 'x'.repeat(chatSchemas.CHAT_MESSAGE_TEXT_MAX_LENGTH + 1);
    expect(chatSchemas.ChatSendPayloadSchema.parse({ clientMessageId: 'm1', text: longText })).toEqual({ clientMessageId: 'm1', text: longText });
    expect(chatSchemas.ChatSendPayloadSchema.safeParse({ clientMessageId: '', text: 'hi' }).success).toBe(false);
    expect(
      chatSchemas.ChatSendPayloadSchema.safeParse({ clientMessageId: 'm'.repeat(chatSchemas.CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH + 1), text: 'hi' }).success,
    ).toBe(false);
    expect(chatSchemas.ChatSendPayloadSchema.safeParse({ clientMessageId: 'm1' }).success).toBe(false);
  });

  it('a send carries no reply pointer or attachment: extra keys never reach the room', () => {
    expect(chatSchemas.ChatSendPayloadSchema.parse({ clientMessageId: 'm1', text: 'hi', replyTo: 'm0', attachment: {} })).toEqual({
      clientMessageId: 'm1',
      text: 'hi',
    });
  });

  it('a read-ack carries a whole non-negative seq and whether the conversation is in focus (unfocused when absent)', () => {
    expect(chatSchemas.ChatReadAckPayloadSchema.parse({ readSeq: 5, focused: true })).toEqual({ readSeq: 5, focused: true });
    expect(chatSchemas.ChatReadAckPayloadSchema.parse({ readSeq: 0 })).toEqual({ readSeq: 0, focused: false });
    for (const readSeq of [-1, 1.5, '5', null]) {
      expect(chatSchemas.ChatReadAckPayloadSchema.safeParse({ readSeq }).success).toBe(false);
    }
    expect(chatSchemas.ChatReadAckPayloadSchema.safeParse({ readSeq: 1, focused: 'yes' }).success).toBe(false);
  });

  it('a history request pages before a positive seq, never past the page cap', () => {
    expect(chatSchemas.ChatHistoryPayloadSchema.parse({})).toEqual({ limit: chatSchemas.HISTORY_PAGE_MAX });
    expect(chatSchemas.ChatHistoryPayloadSchema.parse({ beforeSeq: null, limit: 10 })).toEqual({ beforeSeq: null, limit: 10 });
    expect(chatSchemas.ChatHistoryPayloadSchema.safeParse({ beforeSeq: 0 }).success).toBe(false);
    expect(chatSchemas.ChatHistoryPayloadSchema.safeParse({ beforeSeq: '9' }).success).toBe(false);
    expect(chatSchemas.ChatHistoryPayloadSchema.safeParse({ limit: chatSchemas.HISTORY_PAGE_MAX + 1 }).success).toBe(false);
    expect(chatSchemas.ChatHistoryPayloadSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('a resume names the last seq the client holds, or none', () => {
    expect(chatSchemas.ChatResumePayloadSchema.parse({ afterSeq: 0 })).toEqual({ afterSeq: 0 });
    expect(chatSchemas.ChatResumePayloadSchema.parse({})).toEqual({});
    expect(chatSchemas.ChatResumePayloadSchema.safeParse({ afterSeq: -1 }).success).toBe(false);
    expect(chatSchemas.ChatResumePayloadSchema.safeParse({ afterSeq: '3' }).success).toBe(false);
  });
});

describe('message revision kinds', () => {
  it('is the closed set of what a revision does to a message', () => {
    expect(chatSchemas.CHAT_MESSAGE_REVISION_KINDS).toEqual(['delete', 'moderate', 'edit', 'restore']);
    for (const kind of chatSchemas.CHAT_MESSAGE_REVISION_KINDS) {
      expect(chatSchemas.ChatMessageRevisionKindSchema.parse(kind)).toBe(kind);
    }
  });

  it('refuses any other kind', () => {
    for (const kind of ['hide', 'Delete', '', null]) {
      expect(chatSchemas.ChatMessageRevisionKindSchema.safeParse(kind).success).toBe(false);
    }
  });
});
