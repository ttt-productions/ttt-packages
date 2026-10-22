import { z } from 'zod';
import {
  CHAT_SYSTEM_SENDER_ID,
  type ChatServerMessagePayload,
} from '@ttt-productions/chat-schemas';
import { userIdSchema } from '../schemas/atoms.js';

export const GuildInviteSystemMessageSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('agreed'), actorUid: userIdSchema }).strict(),
  z.object({ event: z.literal('declined'), actorUid: userIdSchema }).strict(),
  z.object({ event: z.literal('cancelled'), actorUid: userIdSchema }).strict(),
  z.object({ event: z.literal('retracted'), actorUid: userIdSchema }).strict(),
  z.object({ event: z.literal('finalized'), recipientUid: userIdSchema }).strict(),
  z.object({ event: z.literal('offerUpdated'), stakeShares: z.number().int().positive() }).strict(),
]);
export type GuildInviteSystemMessage = z.infer<typeof GuildInviteSystemMessageSchema>;

const STORED_MESSAGE_KEY = 'guildInviteSystemMessage';

const StoredEventSchema = z.discriminatedUnion('event', [
  z
    .object({ event: z.enum(['agreed', 'declined', 'cancelled', 'retracted', 'finalized']) })
    .strict(),
  z.object({ event: z.literal('offerUpdated'), stakeShares: z.number().int().positive() }).strict(),
]);

export function encodeGuildInviteSystemMessage(
  message: GuildInviteSystemMessage,
): ChatServerMessagePayload & { referencedUids: string[] } {
  const m = GuildInviteSystemMessageSchema.parse(message);
  const stored =
    m.event === 'offerUpdated'
      ? { event: m.event, stakeShares: m.stakeShares }
      : { event: m.event };
  const referencedUids =
    m.event === 'finalized' ? [m.recipientUid] : m.event === 'offerUpdated' ? [] : [m.actorUid];
  return {
    senderId: CHAT_SYSTEM_SENDER_ID,
    text: JSON.stringify({ [STORED_MESSAGE_KEY]: stored }),
    referencedUids,
  };
}

export function decodeGuildInviteSystemMessage(message: {
  senderId: string;
  text?: string;
  referencedUids?: readonly string[];
}): GuildInviteSystemMessage | null {
  if (message.senderId !== CHAT_SYSTEM_SENDER_ID || typeof message.text !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(message.text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const keys = Object.keys(parsed);
  if (keys.length !== 1 || keys[0] !== STORED_MESSAGE_KEY) return null;
  const stored = StoredEventSchema.safeParse(
    (parsed as Record<string, unknown>)[STORED_MESSAGE_KEY],
  );
  if (!stored.success) return null;
  const refs = message.referencedUids ?? [];
  const event = stored.data;
  const result =
    event.event === 'offerUpdated'
      ? refs.length === 0
        ? GuildInviteSystemMessageSchema.safeParse(event)
        : null
      : refs.length === 1
        ? GuildInviteSystemMessageSchema.safeParse(
            event.event === 'finalized'
              ? { event: event.event, recipientUid: refs[0] }
              : { event: event.event, actorUid: refs[0] },
          )
        : null;
  return result?.success ? result.data : null;
}

export type GuildInviteSystemMessageSegment = { text: string } | { uid: string };

export function guildInviteSystemMessageSegments(
  message: GuildInviteSystemMessage,
): GuildInviteSystemMessageSegment[] {
  switch (message.event) {
    case 'agreed':
      return [{ uid: message.actorUid }, { text: ' agreed to the terms.' }];
    case 'declined':
      return [{ uid: message.actorUid }, { text: ' declined the invitation.' }];
    case 'cancelled':
      return [{ uid: message.actorUid }, { text: ' cancelled the invitation.' }];
    case 'retracted':
      return [{ uid: message.actorUid }, { text: ' has retracted their agreement.' }];
    case 'finalized':
      return [
        { text: 'Deal finalized! The system will now add ' },
        { uid: message.recipientUid },
        { text: ' to the work project.' },
      ];
    case 'offerUpdated':
      return [{ text: `Offer updated to ${message.stakeShares} stake shares.` }];
  }
}
