import { describe, it, expect } from 'vitest';
import { FullCommissionListingSchema } from '../src/doc-schemas/commissions';

const validListing = {
  commissionListingId: 'cl1',
  title: 'Need a colourist',
  description: 'Looking for a colourist for a short film.',
  requiredTradeProfessions: ['colourist'],
  stakeSharesOffered: 10,
  createdAt: 1,
  createdBy: { uid: 'u1' },
  workProjectAssociatedWith: { workProjectId: 'wp1', type: 'Television' },
  status: 'open' as const,
  savedProposalArtisans: [],
  hidden: false,
};

describe('FullCommissionListingSchema — Display Identity Invariant', () => {
  it('accepts a listing whose workProjectAssociatedWith is just { workProjectId, type }', () => {
    expect(FullCommissionListingSchema.safeParse(validListing).success).toBe(true);
  });

  it('keeps the work reference (workProjectId + type) after parse', () => {
    const parsed = FullCommissionListingSchema.parse(validListing);
    expect(parsed.workProjectAssociatedWith.workProjectId).toBe('wp1');
    expect(parsed.workProjectAssociatedWith.type).toBe('Television');
  });

  it('does not surface a snapshotted working title/description on the parsed embed', () => {
    const parsed = FullCommissionListingSchema.parse({
      ...validListing,
      // Even if a caller sends the legacy snapshot fields, the non-strict embed drops them
      // rather than persisting a display-name snapshot (resolved at render instead).
      workProjectAssociatedWith: {
        workProjectId: 'wp1',
        type: 'Television',
        workingTitle: 'STALE TITLE',
        workingDescription: 'STALE DESC',
      },
    });
    expect(parsed.workProjectAssociatedWith).not.toHaveProperty('workingTitle');
    expect(parsed.workProjectAssociatedWith).not.toHaveProperty('workingDescription');
  });

  it('requires a work reference (workProjectId is mandatory)', () => {
    const { workProjectAssociatedWith: _drop, ...noRef } = validListing;
    expect(FullCommissionListingSchema.safeParse(noRef).success).toBe(false);
  });
});
