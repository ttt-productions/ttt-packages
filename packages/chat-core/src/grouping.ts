import type { ChatMessageGroupKey, ChatMessageV1 } from './types.js';
import { GROUP_GAP_SEC } from './types.js';

/**
 * Determine if `msg` is a "continuation" of `prev` for the purpose of
 * visually grouping consecutive messages from the same sender in the
 * message list.
 *
 * A message is a continuation when ALL of the following hold:
 *   - `prev` exists.
 *   - Neither `prev` nor `msg` is a system message.
 *   - `prev` and `msg` have the same `senderId`.
 *   - `msg.createdAt - prev.createdAt` is in the inclusive range
 *     `[0, GROUP_GAP_SEC * 1000]` milliseconds. Negative gaps
 *     (out-of-order messages) are treated as not-a-continuation.
 *   - When the app supplies `groupKey`, both messages have the same key — a
 *     continuation hides the sender line, so a per-message fact the app shows
 *     there must break the group when it changes.
 *
 * Pure function. No side effects. Safe to call from server and client.
 */
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
