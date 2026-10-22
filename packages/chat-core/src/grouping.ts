import type { ChatMessageGroupKey, ChatMessageV1 } from './types.js';
import { GROUP_GAP_SEC } from './types.js';

export function isContinuation(
  prev: ChatMessageV1 | undefined,
  msg: ChatMessageV1,
  groupKey?: ChatMessageGroupKey,
): boolean {
  if (!prev) return false;
  if (msg.isSystemMessage || prev.isSystemMessage) return false;
  if (msg.senderId !== prev.senderId) return false;
  if (groupKey && groupKey(msg) !== groupKey(prev)) return false;
  const gapMs = msg.createdAt - prev.createdAt;
  return gapMs >= 0 && gapMs <= GROUP_GAP_SEC * 1000;
}
