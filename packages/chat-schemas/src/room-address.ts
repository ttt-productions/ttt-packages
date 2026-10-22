// Rooms already exist under these exact strings, so this format is fixed.
import { CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH } from './internal-atoms.js';
import type { ChatRoomKind } from './internal-contract.js';
import {
  CHAT_ACCOUNT_ID_MAX_LENGTH,
  ChatConversationRefSchema,
  type ChatConversationRef,
} from './realtime-wire.js';

export type ChatRoomNamespace = { product: string; env: string };

export type ChatRoom =
  { kind: 'channel'; ref: ChatConversationRef } | { kind: 'inbox'; uid: string };

const SEPARATOR = ':';
const CHANNEL_ROOM: ChatRoomKind = 'channel';
const INBOX_ROOM: ChatRoomKind = 'inbox';

const ROOM_PREFIX_PARTS = 3;

const CONVERSATION_ADDRESS_SEPARATORS = 4;

function isSegment(value: string): boolean {
  return value.length > 0 && !value.includes(SEPARATOR);
}

function isInboxUid(uid: string): boolean {
  return isSegment(uid) && uid.length <= CHAT_ACCOUNT_ID_MAX_LENGTH;
}

function isNamespace(namespace: ChatRoomNamespace): boolean {
  return isSegment(namespace.product) && isSegment(namespace.env);
}

function assertNamespace(namespace: ChatRoomNamespace): void {
  if (!isNamespace(namespace)) {
    throw new RangeError(
      'a chat room namespace needs a non-empty product and env, neither holding ":"',
    );
  }
  const prefixLength =
    namespace.product.length +
    namespace.env.length +
    CHANNEL_ROOM.length +
    CONVERSATION_ADDRESS_SEPARATORS;
  if (prefixLength > CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH) {
    throw new RangeError(
      `a chat room namespace may take at most ${CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH} characters of an address`,
    );
  }
}

export function buildChatRoomAddress(namespace: ChatRoomNamespace, room: ChatRoom): string {
  assertNamespace(namespace);
  const { product, env } = namespace;
  if (room.kind === 'inbox') {
    if (!isInboxUid(room.uid))
      throw new RangeError(
        'an inbox address needs a uid that is one segment no longer than an account id',
      );
    return [product, env, INBOX_ROOM, room.uid].join(SEPARATOR);
  }
  const ref = ChatConversationRefSchema.safeParse(room.ref);
  if (!ref.success)
    throw new RangeError('a conversation room address needs a valid conversation reference');
  return [product, env, CHANNEL_ROOM, ref.data.kind, ref.data.id].join(SEPARATOR);
}

export function parseChatRoomAddress(
  address: string,
  namespace: ChatRoomNamespace,
): ChatRoom | null {
  if (!isNamespace(namespace)) return null;
  const parts = address.split(SEPARATOR);
  if (
    parts.length <= ROOM_PREFIX_PARTS ||
    parts[0] !== namespace.product ||
    parts[1] !== namespace.env
  )
    return null;
  const room = parts[2];
  if (room === INBOX_ROOM) {
    const uid = parts[ROOM_PREFIX_PARTS];
    return parts.length === ROOM_PREFIX_PARTS + 1 && isInboxUid(uid)
      ? { kind: 'inbox', uid }
      : null;
  }
  if (room !== CHANNEL_ROOM || parts.length < ROOM_PREFIX_PARTS + 2) return null;
  const ref = ChatConversationRefSchema.safeParse({
    kind: parts[ROOM_PREFIX_PARTS],
    id: parts.slice(ROOM_PREFIX_PARTS + 1).join(SEPARATOR),
  });
  return ref.success ? { kind: 'channel', ref: ref.data } : null;
}
