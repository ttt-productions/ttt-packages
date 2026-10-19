import { describe, it, expect, expectTypeOf } from 'vitest';
import { NOTIFICATION_FANOUT_PRIORITIES, type NotificationFanoutPriority } from '../src/constants/business-platform';
import { NotificationFanoutPrioritySchema } from '../src/doc-schemas/notification-ledger';
import { DeadLetteredFanoutJobRowSchema } from '../src/schemas/notification';

describe('notification fanout priority tiers', () => {
  it('are 0 urgent, 1 normal, 2 bulk', () => {
    expect(NOTIFICATION_FANOUT_PRIORITIES).toEqual([0, 1, 2]);
    expectTypeOf<NotificationFanoutPriority>().toEqualTypeOf<0 | 1 | 2>();
  });

  it('the stored job priority accepts exactly the tiers', () => {
    for (const tier of NOTIFICATION_FANOUT_PRIORITIES) {
      expect(NotificationFanoutPrioritySchema.parse(tier)).toBe(tier);
    }
    for (const value of [-1, 3, 0.5, '0', null]) {
      expect(NotificationFanoutPrioritySchema.safeParse(value).success).toBe(false);
    }
    expectTypeOf<ReturnType<typeof NotificationFanoutPrioritySchema.parse>>().toEqualTypeOf<NotificationFanoutPriority>();
  });

  it('the Ops Repairs dead-letter row reads the same tiers', () => {
    const priority = DeadLetteredFanoutJobRowSchema.shape.priority;
    expect(priority.safeParse(NOTIFICATION_FANOUT_PRIORITIES[NOTIFICATION_FANOUT_PRIORITIES.length - 1]).success).toBe(true);
    expect(priority.safeParse(NOTIFICATION_FANOUT_PRIORITIES.length).success).toBe(false);
  });
});
