import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_DELETION_REQUEST_ORIGINS,
  AccountDeletionRequestStatusSchema,
  AccountDeletionRequestV1Schema,
  ACTIVE_DELETION_REQUEST_STATUSES,
  MID_SCRUB_DELETION_REQUEST_STATUSES,
  isActiveDeletionRequest,
} from '../src/doc-schemas/account-deletion.js';

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

describe('MID_SCRUB_DELETION_REQUEST_STATUSES completeness against the status union', () => {
  it('contains only members of the canonical status union', () => {
    for (const status of MID_SCRUB_DELETION_REQUEST_STATUSES) {
      expect(ALL_STATUSES).toContain(status);
    }
  });

  it('is exactly the erasure-started-but-unfinished statuses, in union-declaration order', () => {
    expect(MID_SCRUB_DELETION_REQUEST_STATUSES).toEqual(['scrubbing', 'leased']);
  });

  it('is disjoint from the ACTIVE set — a mid-scrub request is neither cancellable nor re-offered', () => {
    for (const status of MID_SCRUB_DELETION_REQUEST_STATUSES) {
      expect(ACTIVE_DELETION_REQUEST_STATUSES).not.toContain(status);
      expect(isActiveDeletionRequest(status)).toBe(false);
    }
  });

  it('leaves only the terminal statuses unclassified by either set', () => {
    const classified = new Set<string>([
      ...ACTIVE_DELETION_REQUEST_STATUSES,
      ...MID_SCRUB_DELETION_REQUEST_STATUSES,
    ]);
    expect(ALL_STATUSES.filter((s) => !classified.has(s)).sort()).toEqual(
      ['cancelled', 'completed', 'superseded'].sort(),
    );
  });
});

describe('isActiveDeletionRequest truth table', () => {
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
    for (const value of [
      undefined,
      null,
      '',
      'PENDING',
      'pending ',
      'unknownStatus',
      0,
      1,
      {},
      [],
      true,
    ]) {
      expect(isActiveDeletionRequest(value)).toBe(false);
    }
  });
});

describe('AccountDeletionRequestV1Schema — the durable token-revocation obligation', () => {
  const baseRequest = () => ({
    schemaVersion: 1,
    uid: 'u1',
    status: 'pending',
    requestedAt: 1_700_000_000_000,
    scheduledScrubAt: 1_702_592_000_000,
    graceDays: 30,
    origin: 'memberRequest',
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  });

  it('parses a request with the revocation obligation still PENDING (tokensRevokedAt absent)', () => {
    const parsed = AccountDeletionRequestV1Schema.parse(baseRequest());
    expect(parsed.tokensRevokedAt).toBeUndefined();
  });

  it('parses a request whose tokens were revoked (tokensRevokedAt stamped)', () => {
    const parsed = AccountDeletionRequestV1Schema.parse({
      ...baseRequest(),
      tokensRevokedAt: 1_700_000_000_500,
    });
    expect(parsed.tokensRevokedAt).toBe(1_700_000_000_500);
  });

  it('rejects a non-number tokensRevokedAt (absent is the only "not yet" representation)', () => {
    expect(
      AccountDeletionRequestV1Schema.safeParse({ ...baseRequest(), tokensRevokedAt: null }).success,
    ).toBe(false);
  });

  it('parses a request with the drain key set (revocation OWED, retry scheduled)', () => {
    const parsed = AccountDeletionRequestV1Schema.parse({
      ...baseRequest(),
      tokenRevocationNextAttemptAt: 1_700_000_060_000,
    });
    expect(parsed.tokenRevocationNextAttemptAt).toBe(1_700_000_060_000);
    expect(parsed.tokensRevokedAt).toBeUndefined();
  });

  it('parses the satisfied shape: drain key DELETED, tokensRevokedAt stamped', () => {
    const parsed = AccountDeletionRequestV1Schema.parse({
      ...baseRequest(),
      tokensRevokedAt: 1_700_000_000_500,
    });
    expect(parsed.tokenRevocationNextAttemptAt).toBeUndefined();
    expect(parsed.tokensRevokedAt).toBe(1_700_000_000_500);
  });

  it('rejects a non-number tokenRevocationNextAttemptAt (absent is the only "not owed" representation)', () => {
    expect(
      AccountDeletionRequestV1Schema.safeParse({
        ...baseRequest(),
        tokenRevocationNextAttemptAt: null,
      }).success,
    ).toBe(false);
  });
});

describe('AccountDeletionRequestV1Schema — where a request came from', () => {
  const request = (origin?: unknown) => ({
    schemaVersion: 1,
    uid: 'u1',
    status: 'parkedOnHold',
    requestedAt: 1_700_000_000_000,
    scheduledScrubAt: 1_700_000_000_000,
    graceDays: 0,
    ...(origin === undefined ? {} : { origin }),
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  });

  it("holds the member's own request and an under-13 closure", () => {
    expect(ACCOUNT_DELETION_REQUEST_ORIGINS).toEqual(['memberRequest', 'discoveredUnder13']);
    for (const origin of ACCOUNT_DELETION_REQUEST_ORIGINS)
      expect(AccountDeletionRequestV1Schema.parse(request(origin)).origin).toBe(origin);
  });

  it('refuses a request that does not say where it came from, or names any other origin', () => {
    expect(AccountDeletionRequestV1Schema.safeParse(request()).success).toBe(false);
    expect(AccountDeletionRequestV1Schema.safeParse(request('adminRequest')).success).toBe(false);
  });
});
