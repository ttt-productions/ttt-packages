import { describe, expect, it } from 'vitest';
import { GuildInviteConversationSchema } from '../src/doc-schemas/messaging';
import { GuildInviteAcceptedAuditPayloadSchema } from '../src/schemas/admin-dispatch-actions';

// The Work's agreement to an invite is one flag any of its invite handlers may give. The invite
// records WHO gave it, and the accept event carries that account, so the record of who committed
// the Work's stake shares survives the conversation's anonymization (BACKEND-201, BACKEND-203).
describe("who agreed for the Work on a guild invite", () => {
  const invite = {
    guildInviteId: 'inv1',
    workProjectId: 'wp1',
    relatedUserIds: ['sender', 'recipient'],
    workProject: { workProjectId: 'wp1', type: 'tales' },
    createdBy: { uid: 'sender' },
    sender: { uid: 'sender' },
    recipient: { uid: 'recipient' },
    stakeSharesOffered: 10,
    source: { type: 'standalone' as const },
    status: 'pending' as const,
    createdAt: 1,
    updatedAt: 1,
    lastUpdatedAt: 1,
    senderConfirmed: true,
    recipientConfirmed: false,
  };

  it('the invite stores the account that agreed for the Work', () => {
    expect(Object.keys(GuildInviteConversationSchema.shape)).toContain('senderConfirmedBy');
    expect(GuildInviteConversationSchema.parse({ ...invite, senderConfirmedBy: 'handler-uid' }).senderConfirmedBy).toBe('handler-uid');
  });

  it('stores an account id, never a path or an empty value', () => {
    expect(GuildInviteConversationSchema.safeParse({ ...invite, senderConfirmedBy: '' }).success).toBe(false);
    expect(GuildInviteConversationSchema.safeParse({ ...invite, senderConfirmedBy: 'a/b' }).success).toBe(false);
  });

  it('the accept event names the Work\'s agreeing account beside the invite and its offer', () => {
    const payload = { workProjectId: 'wp1', guildInviteId: 'inv1', stakeSharesOffered: 10, senderConfirmedBy: 'handler-uid' };
    expect(GuildInviteAcceptedAuditPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('the accept event cannot omit the agreeing account or carry anything else', () => {
    const payload = { workProjectId: 'wp1', guildInviteId: 'inv1', stakeSharesOffered: 10 };
    expect(GuildInviteAcceptedAuditPayloadSchema.safeParse(payload).success).toBe(false);
    expect(
      GuildInviteAcceptedAuditPayloadSchema.safeParse({ ...payload, senderConfirmedBy: 'h', note: 'free text' }).success,
    ).toBe(false);
  });
});
