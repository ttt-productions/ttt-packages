import { describe, it, expect } from 'vitest';
import {
  StakeShareOperationSchema,
  PublicStakeShareOperationSchema,
} from '../src/schemas/stake-share-operation';
import { LeaveWorkProjectInputSchema } from '../src/schemas/work-project-management';
import { GuildmateUserSchema } from '../src/doc-schemas/work-project';

describe('self-leave contract', () => {
  it('StakeShareOperationSchema accepts an internal depart op', () => {
    const r = StakeShareOperationSchema.safeParse({
      type: 'depart',
      user: { uid: 'u1' },
      reason: 'selfLeave',
    });
    expect(r.success).toBe(true);
  });

  it('depart requires a user and rejects an unknown reason or extra keys', () => {
    expect(StakeShareOperationSchema.safeParse({ type: 'depart', reason: 'selfLeave' }).success).toBe(false);
    expect(
      StakeShareOperationSchema.safeParse({ type: 'depart', user: { uid: 'u1' }, reason: 'banned' }).success,
    ).toBe(false);
    expect(
      StakeShareOperationSchema.safeParse({ type: 'depart', user: { uid: 'u1' }, reason: 'selfLeave', amount: 5 }).success,
    ).toBe(false);
  });

  it('PublicStakeShareOperationSchema REJECTS depart — the public surface is add-active only', () => {
    expect(
      PublicStakeShareOperationSchema.safeParse({ type: 'depart', user: { uid: 'u1' }, reason: 'selfLeave' }).success,
    ).toBe(false);
    expect(
      PublicStakeShareOperationSchema.safeParse({ type: 'add-active', user: { uid: 'u1' }, amount: 5 }).success,
    ).toBe(true);
  });

  it('GuildmateUserSchema accepts departedReason: selfLeave', () => {
    expect(
      GuildmateUserSchema.safeParse({
        uid: 'u1',
        guildStandings: [],
        tradeProfessions: [],
        stakeShareCount: 0,
        joinedAt: 1,
        status: 'departed',
        departedReason: 'selfLeave',
        departedAt: 2,
      }).success,
    ).toBe(true);
  });

  it('LeaveWorkProjectInputSchema takes only { workProjectId } and forbids a client-supplied uid', () => {
    expect(LeaveWorkProjectInputSchema.safeParse({ workProjectId: 'wp1' }).success).toBe(true);
    expect(LeaveWorkProjectInputSchema.safeParse({}).success).toBe(false);
    expect(LeaveWorkProjectInputSchema.safeParse({ workProjectId: 'wp1', uid: 'u1' }).success).toBe(false);
  });
});
