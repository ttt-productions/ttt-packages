// A game's event ledger holds exactly the sequences 1..n, because `statEventSequence` is both the
// event count and the last sequence given; anything else is damage the check names.

import { describe, it, expect } from 'vitest';
import { findLedgerContinuityBreak } from '../src/sports/ledger-continuity';
import { STATS_DISCREPANCY_KIND_KEYS } from '../src/types/unions';

const ledger = (...sequences: number[]) => sequences.map((sequence) => ({ sequence }));

describe('findLedgerContinuityBreak', () => {
  it('finds nothing in a healthy ledger, in whatever order its events arrive', () => {
    expect(findLedgerContinuityBreak(ledger(1, 2, 3))).toBeNull();
    expect(findLedgerContinuityBreak(ledger(3, 1, 2))).toBeNull();
  });

  it('finds nothing in an empty ledger: a game with no events holds 1..0', () => {
    expect(findLedgerContinuityBreak([])).toBeNull();
  });

  it('names the first missing sequence of a gap', () => {
    expect(findLedgerContinuityBreak(ledger(1, 2, 100))).toEqual({ kind: 'gap', missingSequence: 3 });
    expect(findLedgerContinuityBreak(ledger(2, 3))).toEqual({ kind: 'gap', missingSequence: 1 });
  });

  it('names a sequence two events hold', () => {
    expect(findLedgerContinuityBreak(ledger(1, 2, 2, 3))).toEqual({ kind: 'duplicate', sequence: 2 });
    expect(findLedgerContinuityBreak(ledger(1, 1))).toEqual({ kind: 'duplicate', sequence: 1 });
  });

  it('is a stats-check finding of its own kind', () => {
    expect(STATS_DISCREPANCY_KIND_KEYS).toContain('eventSequenceGap');
  });
});

describe('the unreadable-game finding', () => {
  it('is a stats-check finding of its own kind', () => {
    expect(STATS_DISCREPANCY_KIND_KEYS).toContain('gameUnreadable');
  });
});
