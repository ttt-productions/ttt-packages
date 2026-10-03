import { describe, it, expect } from 'vitest';
import { CHAT_SYSTEM_SENDER_ID, ChatServerMessagePayloadSchema } from '@ttt-productions/chat-schemas';
import {
  encodeGuildInviteSystemMessage,
  decodeGuildInviteSystemMessage,
  guildInviteSystemMessageSegments,
  type GuildInviteSystemMessage,
  type GuildInviteSystemMessageSegment,
} from '../src/utils/guild-invite-system-message';

/** Renders segments the way a screen does, with a stand-in for each account's current name. */
function render(segments: GuildInviteSystemMessageSegment[], names: Record<string, string>): string {
  return segments.map((s) => ('uid' in s ? names[s.uid] : s.text)).join('');
}

/** A stored server message read back as the chat UI sees it. */
function roundTrip(message: GuildInviteSystemMessage) {
  return decodeGuildInviteSystemMessage(encodeGuildInviteSystemMessage(message));
}

describe('invite system messages name accounts by id, beside the text, and render the current name', () => {
  it('is written as a server message the room accepts, with the account id beside the text and never in it', () => {
    const written = encodeGuildInviteSystemMessage({ event: 'agreed', actorUid: 'uid-123' });
    expect(ChatServerMessagePayloadSchema.safeParse(written).success).toBe(true);
    expect(written.senderId).toBe(CHAT_SYSTEM_SENDER_ID);
    expect(written.referencedUids).toEqual(['uid-123']);
    expect(written.text).not.toContain('uid-123');
    expect(roundTrip({ event: 'agreed', actorUid: 'uid-123' })).toEqual({ event: 'agreed', actorUid: 'uid-123' });
  });

  it('a renamed account reads under its new name — the sentence resolves at display time', () => {
    const segments = guildInviteSystemMessageSegments(roundTrip({ event: 'agreed', actorUid: 'u1' })!);
    expect(render(segments, { u1: 'Old Name' })).toBe('Old Name agreed to the terms.');
    expect(render(segments, { u1: 'New Name' })).toBe('New Name agreed to the terms.');
  });

  it('an erased account renders as whatever its rewritten id resolves to — no copy of the old id survives in the text', () => {
    const written = encodeGuildInviteSystemMessage({ event: 'finalized', recipientUid: 'erased-uid' });
    // The room's anonymization rewrites referencedUids exactly as it rewrites a sender.
    const anonymized = { ...written, referencedUids: ['tombstone-uid'] };
    const decoded = decodeGuildInviteSystemMessage(anonymized)!;
    expect(decoded).toEqual({ event: 'finalized', recipientUid: 'tombstone-uid' });
    expect(JSON.stringify(anonymized)).not.toContain('erased-uid');
  });

  it('keeps every sentence word for word', () => {
    const names = { a: 'Ada', r: 'Rex' };
    const cases: Array<[GuildInviteSystemMessage, string]> = [
      [{ event: 'agreed', actorUid: 'a' }, 'Ada agreed to the terms.'],
      [{ event: 'declined', actorUid: 'a' }, 'Ada declined the invitation.'],
      [{ event: 'cancelled', actorUid: 'a' }, 'Ada cancelled the invitation.'],
      [{ event: 'retracted', actorUid: 'a' }, 'Ada has retracted their agreement.'],
      [{ event: 'finalized', recipientUid: 'r' }, 'Deal finalized! The system will now add Rex to the work project.'],
      [{ event: 'offerUpdated', stakeShares: 25 }, 'Offer updated to 25 stake shares.'],
    ];
    for (const [message, sentence] of cases) {
      expect(render(guildInviteSystemMessageSegments(roundTrip(message)!), names)).toBe(sentence);
    }
  });

  it('a member cannot forge a system line — the same text from a member is an ordinary message', () => {
    const written = encodeGuildInviteSystemMessage({ event: 'agreed', actorUid: 'steward-uid' });
    expect(decodeGuildInviteSystemMessage({ ...written, senderId: 'member-uid' })).toBeNull();
    expect(decodeGuildInviteSystemMessage({ senderId: 'member-uid', text: written.text })).toBeNull();
  });

  it('a system row whose ids do not match its event is not read as one', () => {
    const written = encodeGuildInviteSystemMessage({ event: 'agreed', actorUid: 'a' });
    expect(decodeGuildInviteSystemMessage({ ...written, referencedUids: [] })).toBeNull();
    expect(decodeGuildInviteSystemMessage({ ...written, referencedUids: ['a', 'b'] })).toBeNull();
    const offer = encodeGuildInviteSystemMessage({ event: 'offerUpdated', stakeShares: 3 });
    expect(decodeGuildInviteSystemMessage({ ...offer, referencedUids: ['a'] })).toBeNull();
  });

  it('ordinary system text is not mistaken for an invite system message', () => {
    for (const text of ['hello', '{"guildInviteSystemMessage":{"event":"nope"}}', '{"other":1}', '[]', 'null', '42']) {
      expect(decodeGuildInviteSystemMessage({ senderId: CHAT_SYSTEM_SENDER_ID, text, referencedUids: ['a'] })).toBeNull();
    }
  });

  it('refuses to write a message whose account id is not one id, or an offer of no shares', () => {
    expect(() => encodeGuildInviteSystemMessage({ event: 'agreed', actorUid: 'a/b' })).toThrow();
    expect(() => encodeGuildInviteSystemMessage({ event: 'offerUpdated', stakeShares: 0 })).toThrow();
  });
});
