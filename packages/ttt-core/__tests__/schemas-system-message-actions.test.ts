import { describe, it, expect } from 'vitest';
import {
  UpdateAdminMessageStatusInputSchema,
  UpdateInviteConfirmationInputSchema,
  UpdateInviteSharesInputSchema,
} from '../src/schemas/system-message-actions';

describe('UpdateAdminMessageStatusInputSchema', () => {
  it('accepts a valid input with closed_resolved', () => {
    const input = {
      messageId: 'msg-1',
      newStatus: 'closed_resolved',
      lastMessage: 'Thanks, all resolved.',
    };
    expect(UpdateAdminMessageStatusInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a valid input with closed_unresolved', () => {
    const input = {
      messageId: 'msg-1',
      newStatus: 'closed_unresolved',
      lastMessage: 'Closing without resolution.',
    };
    expect(UpdateAdminMessageStatusInputSchema.parse(input)).toEqual(input);
  });

  it('rejects an unknown newStatus value', () => {
    expect(() =>
      UpdateAdminMessageStatusInputSchema.parse({
        messageId: 'msg-1',
        newStatus: 'open',
        lastMessage: 'x',
      }),
    ).toThrow();
  });

  it('rejects empty lastMessage', () => {
    expect(() =>
      UpdateAdminMessageStatusInputSchema.parse({
        messageId: 'msg-1',
        newStatus: 'closed_resolved',
        lastMessage: '',
      }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      UpdateAdminMessageStatusInputSchema.parse({
        messageId: 'msg-1',
        newStatus: 'closed_resolved',
        lastMessage: 'x',
        extra: 'bad',
      }),
    ).toThrow();
  });
});

describe('UpdateInviteConfirmationInputSchema', () => {
  it('accepts each valid action', () => {
    for (const action of ['agree', 'decline', 'cancel', 'retract'] as const) {
      const input = { inviteId: 'invite-1', action };
      expect(UpdateInviteConfirmationInputSchema.parse(input)).toEqual(input);
    }
  });

  it('rejects an unknown action value', () => {
    expect(() =>
      UpdateInviteConfirmationInputSchema.parse({
        inviteId: 'invite-1',
        action: 'approve',
      }),
    ).toThrow();
  });

  it('rejects empty inviteId', () => {
    expect(() =>
      UpdateInviteConfirmationInputSchema.parse({
        inviteId: '',
        action: 'agree',
      }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      UpdateInviteConfirmationInputSchema.parse({
        inviteId: 'invite-1',
        action: 'agree',
        extra: 'bad',
      }),
    ).toThrow();
  });
});

describe('UpdateInviteSharesInputSchema', () => {
  it('accepts a valid input with newShares: 1', () => {
    const input = { inviteId: 'invite-1', newShares: 1 };
    expect(UpdateInviteSharesInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a valid input with newShares: 50', () => {
    const input = { inviteId: 'invite-1', newShares: 50 };
    expect(UpdateInviteSharesInputSchema.parse(input)).toEqual(input);
  });

  it('rejects newShares: 0', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({ inviteId: 'invite-1', newShares: 0 }),
    ).toThrow();
  });

  it('rejects negative newShares', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({ inviteId: 'invite-1', newShares: -5 }),
    ).toThrow();
  });

  it('rejects non-integer newShares', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({ inviteId: 'invite-1', newShares: 1.5 }),
    ).toThrow();
  });

  it('rejects empty inviteId', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({ inviteId: '', newShares: 10 }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({
        inviteId: 'invite-1',
        newShares: 10,
        extra: 'bad',
      }),
    ).toThrow();
  });
});
