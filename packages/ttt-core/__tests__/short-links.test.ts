import { describe, it, expect } from 'vitest';
import * as schemasBarrel from '../src/schemas';
import { CreateShortLinkInputSchema, ShortLinkTargetTypeSchema } from '../src/schemas';
import { ShortLinkSchema } from '../src/doc-schemas/operational';

const storedLink = {
  shortId: 'abc123',
  shortUrl: 'https://ttt.productions/s/abc123',
  destinationUrl: '/audition/a1',
  type: 'audition' as const,
  metadata: { auditionId: 'a1', auditionEntryId: null, commissionListingId: null, hallItemId: null },
  createdAt: 1,
  createdBy: 'u1',
  clicks: 0,
};

describe('short-link targets', () => {
  it('a whole Hall entry is a share target, beside auditions, entries, and commissions', () => {
    expect(ShortLinkTargetTypeSchema.options).toEqual(
      expect.arrayContaining(['audition', 'audition-entry', 'commission', 'hall-library-item']),
    );
  });

  it('a Hall entry link is created from the Hall entry id', () => {
    expect(CreateShortLinkInputSchema.safeParse({ targetType: 'hall-library-item', hallItemId: 'h1' }).success).toBe(true);
  });

  it('a Hall entry link needs its Hall entry id, as one document-id segment', () => {
    expect(CreateShortLinkInputSchema.safeParse({ targetType: 'hall-library-item' }).success).toBe(false);
    expect(CreateShortLinkInputSchema.safeParse({ targetType: 'hall-library-item', hallItemId: '' }).success).toBe(false);
    expect(CreateShortLinkInputSchema.safeParse({ targetType: 'hall-library-item', hallItemId: 'h1/x' }).success).toBe(false);
  });

  it('a Hall entry link points at the whole entry, never one chapter, track, or episode', () => {
    expect(
      CreateShortLinkInputSchema.safeParse({ targetType: 'hall-library-item', hallItemId: 'h1', subItemId: 's1' }).success,
    ).toBe(false);
  });
});

describe('the stored short link', () => {
  it('stores exactly the target types a link can be created for', () => {
    expect([...ShortLinkSchema.shape.type.options].sort()).toEqual([...ShortLinkTargetTypeSchema.options].sort());
  });

  it('records the Hall entry it points at', () => {
    const hallLink = {
      ...storedLink,
      destinationUrl: '/hall/h1',
      type: 'hall-library-item' as const,
      metadata: { auditionId: null, auditionEntryId: null, commissionListingId: null, hallItemId: 'h1' },
    };
    expect(ShortLinkSchema.safeParse(hallLink).success).toBe(true);
  });

  it('every stored link says which Hall entry it points at, null when none', () => {
    expect(ShortLinkSchema.safeParse(storedLink).success).toBe(true);
    const { hallItemId: _hallItemId, ...withoutHallItem } = storedLink.metadata;
    expect(ShortLinkSchema.safeParse({ ...storedLink, metadata: withoutHallItem }).success).toBe(false);
  });
});

describe('short links are never deleted', () => {
  it('ships no delete input', () => {
    expect('DeleteShortLinkInputSchema' in schemasBarrel).toBe(false);
  });
});
