import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createBeaconStampSchema } from '../src/beacon-stamp.js';

const schema = createBeaconStampSchema({
  section: z.enum(['list', 'summary']),
  itemId: z.string().min(1).optional(),
});

const stamp = { updatedAt: 1_700_000_000_000, changeId: 'aB3dE5gH7jK9mN1pQ3sT', section: 'list' };

describe('createBeaconStampSchema', () => {
  it("reads a stamp with the app's own fields plugged in", () => {
    expect(schema.parse(stamp)).toEqual(stamp);
    expect(schema.parse({ ...stamp, itemId: 'i1' })).toEqual({ ...stamp, itemId: 'i1' });
  });

  it('refuses a stamp with no change id or an empty one', () => {
    expect(schema.safeParse({ updatedAt: 5, section: 'list' }).success).toBe(false);
    expect(schema.safeParse({ ...stamp, changeId: '' }).success).toBe(false);
  });

  it('refuses a time that is not whole, non-negative epoch milliseconds', () => {
    expect(schema.safeParse({ ...stamp, updatedAt: '2026-01-01' }).success).toBe(false);
    expect(schema.safeParse({ ...stamp, updatedAt: 1.5 }).success).toBe(false);
    expect(schema.safeParse({ ...stamp, updatedAt: -1 }).success).toBe(false);
    expect(schema.safeParse({ ...stamp, updatedAt: 0 }).success).toBe(true);
  });

  it("refuses a value the app's own field does not accept", () => {
    expect(schema.safeParse({ ...stamp, section: 'other' }).success).toBe(false);
  });

  it('drops a field it does not declare, neither refusing nor keeping it (RULE-STD-ARCH-110)', () => {
    expect(schema.parse({ ...stamp, extra: 1 })).toEqual(stamp);
  });
});
