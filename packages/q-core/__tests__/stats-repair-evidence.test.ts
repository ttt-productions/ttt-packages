import { describe, expect, it } from 'vitest';
import { CURLING_ROUND_COUNT, MAX_CURLING_ROUND_POINTS } from '../src/constants/sports.js';
import {
  GameStatsCorrectionOperationSchema,
  HistoricalStatsUpdateOperationSchema,
} from '../src/doc-schemas/stats-operation.js';
import { GameRepairChangesSchema } from '../src/schemas/stats.js';
import type { GameStatsCorrectionTarget } from '../src/schemas/stats.js';
import { AUDIT_EVENT_TYPE_KEYS } from '../src/types/audit.js';
import { hashStatsOperationRequest } from '../src/utils/stats-operation-request.js';
import type { StatsOperationRequest } from '../src/utils/stats-operation-request.js';

const NOW = 1_800_000_000_000;
const target = (
  stat: GameStatsCorrectionTarget['stat'],
  value: number,
): GameStatsCorrectionTarget => ({
  teamId: 'T1',
  playerUserId: 'u1',
  stat,
  value,
});
const correction = (targets: GameStatsCorrectionTarget[]): StatsOperationRequest => ({
  kind: 'gameStatsCorrection',
  scope: { gameId: 'g1' },
  targets,
});
const BASELINE = { gamesPlayed: 3, points: 10, rebounds: 4, assists: 2 };

describe('the request a held stats operation is bound to', () => {
  it('hashes one request the same each time, as a lowercase SHA-256 hex digest', async () => {
    const hash = await hashStatsOperationRequest(correction([target('points', 10)]));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashStatsOperationRequest(correction([target('points', 10)]))).toBe(hash);
  });

  it('tells apart a request with other values, another game, or kept stored numbers', async () => {
    const started = await hashStatsOperationRequest(correction([target('points', 10)]));
    expect(await hashStatsOperationRequest(correction([target('points', 20)]))).not.toBe(started);
    expect(
      await hashStatsOperationRequest({
        kind: 'gameStatsCorrection',
        scope: { gameId: 'g2' },
        targets: [target('points', 10)],
      }),
    ).not.toBe(started);
    expect(
      await hashStatsOperationRequest({
        kind: 'gameStatsCorrection',
        scope: { gameId: 'g1' },
        keepStored: true,
      }),
    ).not.toBe(started);
  });

  it('reads the same targets in another order as the same request', async () => {
    expect(
      await hashStatsOperationRequest(correction([target('points', 10), target('rebounds', 2)])),
    ).toBe(
      await hashStatsOperationRequest(correction([target('rebounds', 2), target('points', 10)])),
    );
  });

  it('binds a baseline save to its values and its person and sport', async () => {
    const save = (stats: typeof BASELINE, userId = 'u1'): StatsOperationRequest => ({
      kind: 'historicalStatsUpdate',
      scope: { userId, sportKey: 'basketball' },
      stats,
    });
    const started = await hashStatsOperationRequest(save(BASELINE));
    expect(await hashStatsOperationRequest(save({ ...BASELINE, points: 11 }))).not.toBe(started);
    expect(await hashStatsOperationRequest(save(BASELINE, 'u2'))).not.toBe(started);
  });
});

describe('a stored stats operation', () => {
  const opened = {
    startedByUserId: 'admin-1',
    startedAt: NOW,
    updatedAt: NOW,
    status: 'running',
    counts: { read: 0, changed: 0, skipped: 0 },
    reason: 'Correct the box score.',
  };
  const HASH = 'a'.repeat(64);

  it('keeps the request hash it was opened with', () => {
    const game = { ...opened, kind: 'gameStatsCorrection', scope: { gameId: 'g1' } };
    const baseline = {
      ...opened,
      kind: 'historicalStatsUpdate',
      scope: { userId: 'u1', sportKey: 'basketball' },
    };
    expect(
      GameStatsCorrectionOperationSchema.safeParse({ ...game, requestHash: HASH }).success,
    ).toBe(true);
    expect(
      HistoricalStatsUpdateOperationSchema.safeParse({ ...baseline, requestHash: HASH }).success,
    ).toBe(true);
  });

  it('still reads an operation stored before it held one', () => {
    expect(
      GameStatsCorrectionOperationSchema.safeParse({
        ...opened,
        kind: 'gameStatsCorrection',
        scope: { gameId: 'g1' },
      }).success,
    ).toBe(true);
  });

  it('refuses a hash that is not a SHA-256 hex digest', () => {
    const game = { ...opened, kind: 'gameStatsCorrection', scope: { gameId: 'g1' } };
    for (const requestHash of ['', 'A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64)]) {
      expect(GameStatsCorrectionOperationSchema.safeParse({ ...game, requestHash }).success).toBe(
        false,
      );
    }
  });
});

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
