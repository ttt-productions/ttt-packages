import { z } from 'zod';
import { checkInputFormat, defineInputFormat } from '@ttt-productions/input-format-core';

// RULE-STD-ARCH-201 NAMED EXCEPTION — a wire value every tree and every browser shares.
export const CHAT_SUBPROTOCOL = 'ttt.chat.v1' as const;

export const CHAT_WIRE_VERSION = 1 as const;

export const CLIENT_KINDS = {
  SEND: 'send',
  READ_ACK: 'read-ack',
  HISTORY: 'history',
  TYPING: 'typing',
  PRESENCE_SUBSCRIBE: 'presence-subscribe',
  PRESENCE_UNSUBSCRIBE: 'presence-unsubscribe',
  HEARTBEAT: 'heartbeat',
  RESUME: 'resume',
  MARK_READ: 'mark-read',
} as const;

export type ClientFrameKind = (typeof CLIENT_KINDS)[keyof typeof CLIENT_KINDS];

export const SERVER_KINDS = {
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
} as const;

export type ServerFrameKind = (typeof SERVER_KINDS)[keyof typeof SERVER_KINDS];

export const CHAT_MESSAGE_TEXT_MAX_LENGTH = 4000;

export const CHAT_MESSAGE_TEXT_INPUT = defineInputFormat({
  format: 'none',
  min: 1,
  max: CHAT_MESSAGE_TEXT_MAX_LENGTH,
});

export type ChatMessageTextJudgement =
  | { ok: true; text: string }
  | { ok: false; code: Extract<ChatSendRejectionCode, 'blank' | 'too-long'> };

export function judgeChatMessageText(text: string): ChatMessageTextJudgement {
  const result = checkInputFormat(text, CHAT_MESSAGE_TEXT_INPUT);
  if (result.ok) return { ok: true, text: result.value };
  // A `none` text has no character rule, so the only failures are its two length bounds.
  return { ok: false, code: result.issue === 'tooShort' ? 'blank' : 'too-long' };
}

export const CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH = 200;

export const ChatClientMessageIdSchema = z.string().min(1).max(CHAT_CLIENT_MESSAGE_ID_MAX_LENGTH);

export const CHAT_SYSTEM_SENDER_ID = 'system' as const;

export const CHAT_ACCOUNT_ID_MAX_LENGTH = 128;

export const CHAT_MESSAGE_REFERENCED_UIDS_MAX = 4;

export const ChatReferencedUidsSchema = z
  .array(z.string().min(1).max(CHAT_ACCOUNT_ID_MAX_LENGTH))
  .max(CHAT_MESSAGE_REFERENCED_UIDS_MAX);

export const CHAT_SEND_REJECTION_CODES = [
  'membership-pending',
  'archived',
  'deleted',
  'wordlist-unavailable',
  'blocked-word',
  'flood',
  'slow-mode',
  'too-long',
  'blank',
] as const;

export type ChatSendRejectionCode = (typeof CHAT_SEND_REJECTION_CODES)[number];

export const CHAT_SEND_REJECTION_RETRYABLE: Record<ChatSendRejectionCode, boolean> = {
  'membership-pending': true,
  'wordlist-unavailable': true,
  flood: true,
  'slow-mode': true,
  archived: false,
  deleted: false,
  'blocked-word': false,
  'too-long': false,
  blank: false,
};

export const ChatSendRejectedPayloadSchema = z
  .object({
    clientMessageId: ChatClientMessageIdSchema,
    code: z.enum(CHAT_SEND_REJECTION_CODES),
    retryable: z.boolean(),
    retryAfterMs: z.number().int().positive().max(600_000).optional(),
  })
  .refine((p) => p.retryable === CHAT_SEND_REJECTION_RETRYABLE[p.code], {
    message: 'retryable must match the canonical classification for the code',
    path: ['retryable'],
  });

export type ChatSendRejectedPayload = z.infer<typeof ChatSendRejectedPayloadSchema>;

export const CHAT_CLOSE_CODES = {
  AUTH_EXPIRED: 4401,
  REVOKED: 4403,
  FLOOD: 4408,
  TOO_LARGE: 4413,
  SOCKET_CAP: 4429,
  OVERLOADED: 1013,
} as const;

export type ChatCloseCode = (typeof CHAT_CLOSE_CODES)[keyof typeof CHAT_CLOSE_CODES];

export const CHAT_CONVERSATION_KIND_MAX_LENGTH = 32;

export const CHAT_CONVERSATION_ID_MAX_LENGTH = 4096;

export type ChatConversationRef = { kind: string; id: string };

export const ChatConversationRefSchema: z.ZodType<ChatConversationRef> = z
  .object({
    kind: z
      .string()
      .max(CHAT_CONVERSATION_KIND_MAX_LENGTH)
      .regex(/^[a-z][A-Za-z0-9]*$/),
    id: z
      .string()
      .min(1)
      .max(CHAT_CONVERSATION_ID_MAX_LENGTH)
      .refine((id) => !hasControlCharacter(id), {
        message: 'id must not contain control characters',
      }),
  })
  .strict();

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export type ChatGrantScope =
  { kind: 'channel'; channelRef: ChatConversationRef } | { kind: 'inbox'; uid: string };

export const ChatGrantScopeSchema: z.ZodType<ChatGrantScope> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('channel'), channelRef: ChatConversationRefSchema }).strict(),
  z.object({ kind: z.literal('inbox'), uid: z.string().min(1) }).strict(),
]);

// RULE-STD-ARCH-201 NAMED EXCEPTION — a wire value every tree and every browser shares.
export const CHAT_GRANT_AUDIENCE = 'ttt-chat' as const;

export const ChatGrantClaimsSchema = z
  .object({
    v: z.literal(1),
    typ: z.literal('grant'),
    aud: z.literal(CHAT_GRANT_AUDIENCE),
    env: z.string().min(1),
    uid: z.string().min(1),
    scope: ChatGrantScopeSchema,
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
  })
  .strict()
  .refine((claims) => claims.exp > claims.iat, { message: 'exp must be after iat', path: ['exp'] });
export type ChatGrantClaims = z.infer<typeof ChatGrantClaimsSchema>;

export const MODERATION_REDACTED_TEXT = '[message removed]' as const;

export const HEARTBEAT_MS = 20_000;

export const TYPING_COALESCE_MS = 2_000;

export const HISTORY_PAGE_MAX = 50;

export const CHAT_INBOX_CHANNEL_REF_MAX_LENGTH = 200;

export const CHAT_REQUEST_ID_MAX_LENGTH = 200;

export const ChatRequestIdSchema = z.string().min(1).max(CHAT_REQUEST_ID_MAX_LENGTH);

export const ChatMarkReadPayloadSchema = z.object({
  channelRef: z.string().min(1).max(CHAT_INBOX_CHANNEL_REF_MAX_LENGTH),
  requestId: ChatRequestIdSchema,
});
export type ChatMarkReadPayload = z.infer<typeof ChatMarkReadPayloadSchema>;

export const CHAT_MARK_READ_FAILURE_CODES = ['bad-mark-read', 'mark-read-failed'] as const;
export type ChatMarkReadFailureCode = (typeof CHAT_MARK_READ_FAILURE_CODES)[number];

export const ChatMarkReadResultPayloadSchema = z.discriminatedUnion('ok', [
  z.object({ requestId: ChatRequestIdSchema, ok: z.literal(true) }),
  z.object({
    requestId: ChatRequestIdSchema,
    ok: z.literal(false),
    code: z.enum(CHAT_MARK_READ_FAILURE_CODES),
  }),
]);
export type ChatMarkReadResultPayload = z.infer<typeof ChatMarkReadResultPayloadSchema>;

// Unknown keys are stripped, not rejected, so a client one release ahead still parses.
export const ChatSendPayloadSchema = z.object({
  clientMessageId: ChatClientMessageIdSchema,
  text: z.string(),
});
export type ChatSendPayload = z.infer<typeof ChatSendPayloadSchema>;

export const ChatReadAckPayloadSchema = z.object({
  readSeq: z.number().int().nonnegative(),
  focused: z.boolean().default(false),
});
export type ChatReadAckPayload = z.infer<typeof ChatReadAckPayloadSchema>;

export const ChatHistoryPayloadSchema = z.object({
  beforeSeq: z.number().int().positive().nullish(),
  limit: z.number().int().positive().max(HISTORY_PAGE_MAX).default(HISTORY_PAGE_MAX),
});
export type ChatHistoryPayload = z.infer<typeof ChatHistoryPayloadSchema>;

export const ChatResumePayloadSchema = z.object({
  afterSeq: z.number().int().nonnegative().nullish(),
});
export type ChatResumePayload = z.infer<typeof ChatResumePayloadSchema>;

export const CHAT_MESSAGE_REVISION_KINDS = ['delete', 'moderate', 'edit', 'restore'] as const;
export type ChatMessageRevisionKind = (typeof CHAT_MESSAGE_REVISION_KINDS)[number];
export const ChatMessageRevisionKindSchema = z.enum(CHAT_MESSAGE_REVISION_KINDS);
