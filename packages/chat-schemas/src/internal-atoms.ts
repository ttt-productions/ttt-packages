import { z } from 'zod';
import {
  CHAT_CONVERSATION_ID_MAX_LENGTH,
  CHAT_CONVERSATION_KIND_MAX_LENGTH,
} from './realtime-wire.js';

export const CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH = 64;

export const CHAT_ROOM_TARGET_MAX_LENGTH =
  CHAT_ROOM_TARGET_PREFIX_MAX_LENGTH +
  CHAT_CONVERSATION_KIND_MAX_LENGTH +
  CHAT_CONVERSATION_ID_MAX_LENGTH;

export const CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH = 200;

export const CHAT_DIGEST_MAX_LENGTH = 128;

export const roomTargetSchema = z.string().min(1).max(CHAT_ROOM_TARGET_MAX_LENGTH);
export const operationIdSchema = z.string().min(1).max(CHAT_INTERNAL_OPERATION_ID_MAX_LENGTH);
export const digestSchema = z.string().min(1).max(CHAT_DIGEST_MAX_LENGTH);
