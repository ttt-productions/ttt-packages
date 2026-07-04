import { describe, it, expect } from 'vitest';
import {
  UpdateAdminDispatchStatusInputSchema,
  UpdateInviteConfirmationInputSchema,
  UpdateGuildInviteStakeSharesInputSchema,
} from '../src/schemas/admin-dispatch-actions';

describe('UpdateAdminDispatchStatusInputSchema', () => {
  it('accepts a valid input with closed_resolved', () => {
    const input = {
      adminDispatchId: 'msg-1',
      newStatus: 'closed_resolved',
    };
    expect(UpdateAdminDispatchStatusInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a valid input with closed_unresolved', () => {
    const input = {
      adminDispatchId: 'msg-1',
      newStatus: 'closed_unresolved',
    };
    expect(UpdateAdminDispatchStatusInputSchema.parse(input)).toEqual(input);
  });

  it('rejects an unknown newStatus value', () => {
    expect(() =>
      UpdateAdminDispatchStatusInputSchema.parse({
        adminDispatchId: 'msg-1',
        newStatus: 'open',
      }),
    ).toThrow();
  });

  it('rejects a client-supplied lastMessage (close text is composed server-side; .strict)', () => {
    expect(() =>
      UpdateAdminDispatchStatusInputSchema.parse({
        adminDispatchId: 'msg-1',
        newStatus: 'closed_resolved',
        lastMessage: 'x',
      }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      UpdateAdminDispatchStatusInputSchema.parse({
        adminDispatchId: 'msg-1',
        newStatus: 'closed_resolved',
        extra: 'bad',
      }),
    ).toThrow();
  });
});

describe('UpdateInviteConfirmationInputSchema', () => {
  it('accepts each valid action', () => {
    for (const action of ['agree', 'decline', 'cancel', 'retract'] as const) {
      const input = { guildInviteId: 'invite-1', action };
      expect(UpdateInviteConfirmationInputSchema.parse(input)).toEqual(input);
    }
  });

  it('rejects an unknown action value', () => {
    expect(() =>
      UpdateInviteConfirmationInputSchema.parse({
        guildInviteId: 'invite-1',
        action: 'approve',
      }),
    ).toThrow();
  });

  it('rejects empty guildInviteId', () => {
    expect(() =>
      UpdateInviteConfirmationInputSchema.parse({
        guildInviteId: '',
        action: 'agree',
      }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      UpdateInviteConfirmationInputSchema.parse({
        guildInviteId: 'invite-1',
        action: 'agree',
        extra: 'bad',
      }),
    ).toThrow();
  });
});

describe('UpdateGuildInviteStakeSharesInputSchema', () => {
  it('accepts a valid input with newStakeShares: 1', () => {
    const input = { guildInviteId: 'invite-1', newStakeShares: 1 };
    expect(UpdateGuildInviteStakeSharesInputSchema.parse(input)).toEqual(input);
  });

  it('accepts a valid input with newStakeShares: 50', () => {
    const input = { guildInviteId: 'invite-1', newStakeShares: 50 };
    expect(UpdateGuildInviteStakeSharesInputSchema.parse(input)).toEqual(input);
  });

  it('rejects newStakeShares: 0', () => {
    expect(() =>
      UpdateGuildInviteStakeSharesInputSchema.parse({ guildInviteId: 'invite-1', newStakeShares: 0 }),
    ).toThrow();
  });

  it('rejects negative newStakeShares', () => {
    expect(() =>
      UpdateGuildInviteStakeSharesInputSchema.parse({ guildInviteId: 'invite-1', newStakeShares: -5 }),
    ).toThrow();
  });

  it('rejects non-integer newStakeShares', () => {
    expect(() =>
      UpdateGuildInviteStakeSharesInputSchema.parse({ guildInviteId: 'invite-1', newStakeShares: 1.5 }),
    ).toThrow();
  });

  it('rejects empty guildInviteId', () => {
    expect(() =>
      UpdateGuildInviteStakeSharesInputSchema.parse({ guildInviteId: '', newStakeShares: 10 }),
    ).toThrow();
  });

  it('rejects unknown top-level keys (.strict)', () => {
    expect(() =>
      UpdateGuildInviteStakeSharesInputSchema.parse({
        guildInviteId: 'invite-1',
        newStakeShares: 10,
        extra: 'bad',
      }),
    ).toThrow();
  });
});




