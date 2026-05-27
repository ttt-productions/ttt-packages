import { describe, it, expect } from 'vitest';
import {
  UpdateAdminDispatchStatusInputSchema,
  UpdateInviteConfirmationInputSchema,
  UpdateInviteSharesInputSchema,
} from '../src/schemas/admin-dispatch-actions';

describe('UpdateAdminDispatchStatusInputSchema', () => {
  it('accepts a valid input with closed_resolved', () => {
    const input = {
      adminDispatchId: 'msg-1',
      newStatus: 'closed_resolved',
      lastMessage: 'Thanks, all resolved.',
    };
    expect(UpdateAdminDispatchStatusInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a valid input with closed_unresolved', () => {
    const input = {
      adminDispatchId: 'msg-1',
      newStatus: 'closed_unresolved',
      lastMessage: 'Closing without resolution.',
    };
    expect(UpdateAdminDispatchStatusInputSchema.parse(input)).toEqual(input);
  });

  it('rejects an unknown newStatus value', () => {
    expect(() =>
      UpdateAdminDispatchStatusInputSchema.parse({
        adminDispatchId: 'msg-1',
        newStatus: 'open',
        lastMessage: 'x',
      }),
    ).toThrow();
  });

  it('rejects empty lastMessage', () => {
    expect(() =>
      UpdateAdminDispatchStatusInputSchema.parse({
        adminDispatchId: 'msg-1',
        newStatus: 'closed_resolved',
        lastMessage: '',
      }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      UpdateAdminDispatchStatusInputSchema.parse({
        adminDispatchId: 'msg-1',
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
  it('accepts a valid input with newStakeShares: 1', () => {
    const input = { inviteId: 'invite-1', newStakeShares: 1 };
    expect(UpdateInviteSharesInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a valid input with newStakeShares: 50', () => {
    const input = { inviteId: 'invite-1', newStakeShares: 50 };
    expect(UpdateInviteSharesInputSchema.parse(input)).toEqual(input);
  });

  it('rejects newStakeShares: 0', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({ inviteId: 'invite-1', newStakeShares: 0 }),
    ).toThrow();
  });

  it('rejects negative newStakeShares', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({ inviteId: 'invite-1', newStakeShares: -5 }),
    ).toThrow();
  });

  it('rejects non-integer newStakeShares', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({ inviteId: 'invite-1', newStakeShares: 1.5 }),
    ).toThrow();
  });

  it('rejects empty inviteId', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({ inviteId: '', newStakeShares: 10 }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      UpdateInviteSharesInputSchema.parse({
        inviteId: 'invite-1',
        newStakeShares: 10,
        extra: 'bad',
      }),
    ).toThrow();
  });
});


