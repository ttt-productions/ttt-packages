// The ONE "active account-deletion request" predicate (ARCH-102). The status classification is an
// exhaustive Record over AccountDeletionRequestStatus, so adding a lifecycle status is a COMPILE
// error until it is classified — that half of the completeness guarantee is enforced by tsc, not
// here. These tests cover the runtime half: the projected set contains only real union members,
// the helper agrees with the set across the whole union, and unrecognized/absent values are false.

import { describe, it, expect } from 'vitest';
import {
  AccountDeletionRequestStatusSchema,
  ACTIVE_DELETION_REQUEST_STATUSES,
  isActiveDeletionRequest,
} from '../src/doc-schemas/account-deletion';

const ALL_STATUSES = AccountDeletionRequestStatusSchema.options;

describe('ACTIVE_DELETION_REQUEST_STATUSES completeness against the status union', () => {
  it('contains only members of the canonical status union', () => {
    for (const status of ACTIVE_DELETION_REQUEST_STATUSES) {
      expect(ALL_STATUSES).toContain(status);
    }
  });

  it('is exactly the open, still-cancellable statuses, in union-declaration order', () => {
    expect(ACTIVE_DELETION_REQUEST_STATUSES).toEqual(['pending', 'parkedOnHold']);
  });

  it('partitions the union — every status is classified exactly one way', () => {
    const active = ALL_STATUSES.filter((s) => isActiveDeletionRequest(s));
    const inactive = ALL_STATUSES.filter((s) => !isActiveDeletionRequest(s));
    expect([...active, ...inactive].sort()).toEqual([...ALL_STATUSES].sort());
    for (const status of inactive) {
      expect(ACTIVE_DELETION_REQUEST_STATUSES).not.toContain(status);
    }
  });

  it('agrees with the helper across every union member', () => {
    expect(ALL_STATUSES.filter((s) => isActiveDeletionRequest(s))).toEqual(
      ACTIVE_DELETION_REQUEST_STATUSES,
    );
  });
});

describe('isActiveDeletionRequest truth table', () => {
  // Every union member, spelled out: the mid-scrub (scrubbing/leased) and terminal
  // (cancelled/completed/superseded) statuses are NOT cancellable-active.
  const TRUTH_TABLE: ReadonlyArray<[string, boolean]> = [
    ['pending', true],
    ['parkedOnHold', true],
    ['cancelled', false],
    ['scrubbing', false],
    ['leased', false],
    ['completed', false],
    ['superseded', false],
  ];

  it('covers every status in the canonical union', () => {
    expect(TRUTH_TABLE.map(([status]) => status).sort()).toEqual([...ALL_STATUSES].sort());
  });

  for (const [status, expected] of TRUTH_TABLE) {
    it(`'${status}' → ${expected}`, () => {
      expect(isActiveDeletionRequest(status)).toBe(expected);
    });
  }

  it('is false for unknown, absent, and non-string values', () => {
    for (const value of [undefined, null, '', 'PENDING', 'pending ', 'unknownStatus', 0, 1, {}, [], true]) {
      expect(isActiveDeletionRequest(value)).toBe(false);
    }
  });
});
