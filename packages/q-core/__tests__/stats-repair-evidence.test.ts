import { describe, expect, it } from 'vitest';
import { CURLING_ROUND_COUNT, MAX_CURLING_ROUND_POINTS } from '../src/constants/sports.js';
import { GameRepairChangesSchema } from '../src/schemas/stats.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';

describe("a game repair's round-slot evidence", () => {
  const changes = (roundSlots?: unknown) => ({
    lines: [],
    scores: [],
    ...(roundSlots === undefined ? {} : { roundSlots }),
  });
  const slot = (slotIndex: number, stored: number | null, rebuilt: number | null) => ({
    lineKey: 'T1',
    slotIndex,
    stored,
    rebuilt,
  });

  it('names each changed slot, two swapped slots with an unchanged total included', () => {
    expect(GameRepairChangesSchema.safeParse(changes([slot(0, 3, 1), slot(1, 1, 3)])).success).toBe(
      true,
    );
  });

  it('holds an unplayed slot as null on either side', () => {
    expect(GameRepairChangesSchema.safeParse(changes([slot(13, null, 2)])).success).toBe(true);
    expect(GameRepairChangesSchema.safeParse(changes([slot(0, 2, null)])).success).toBe(true);
  });

  it('is absent for a repair that changed no slot, never an empty list', () => {
    expect(GameRepairChangesSchema.safeParse(changes()).success).toBe(true);
    expect(GameRepairChangesSchema.safeParse(changes([])).success).toBe(false);
  });

  it('bounds the slots by the rounds a curling line holds', () => {
    expect(
      GameRepairChangesSchema.safeParse(changes([slot(CURLING_ROUND_COUNT, 1, 2)])).success,
    ).toBe(false);
    expect(GameRepairChangesSchema.safeParse(changes([slot(-1, 1, 2)])).success).toBe(false);
    expect(
      GameRepairChangesSchema.safeParse(changes([slot(0, MAX_CURLING_ROUND_POINTS + 1, 0)]))
        .success,
    ).toBe(false);
    const everySlotOfTwoLines = ['T1', 'T2'].flatMap((lineKey) =>
      Array.from({ length: CURLING_ROUND_COUNT }, (_, slotIndex) => ({
        ...slot(slotIndex, 1, 2),
        lineKey,
      })),
    );
    expect(GameRepairChangesSchema.safeParse(changes(everySlotOfTwoLines)).success).toBe(true);
    expect(
      GameRepairChangesSchema.safeParse(changes([...everySlotOfTwoLines, slot(0, 1, 2)])).success,
    ).toBe(false);
  });
});

describe('the group award decision event', () => {
  it('is an audit event type', () => {
    expect(AUDIT_EVENT_TYPE_KEYS as readonly string[]).toContain('award.groupDecisionOpened');
  });
});
