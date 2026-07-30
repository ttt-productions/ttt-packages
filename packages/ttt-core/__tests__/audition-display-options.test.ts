// Audition board display + filter/sort contracts (constants/options.ts). ttt-core owns the
// audition type labels, the board's ALL filter sentinel, and the typed sort keys, so every
// client renders the same copy and no surface hand-rolls its own filter/sort state.

import { describe, it, expect } from 'vitest';
import {
  AUDITION_TYPES,
  AUDITION_TYPE_FILTER_ALL,
  AUDITION_SORT_OPTIONS,
  DEFAULT_AUDITION_SORT,
  type AuditionTypeFilter,
  type AuditionSortKey,
} from '../src/constants/options';
import { AuditionTypeSchema } from '../src/doc-schemas/commissions';

describe('AUDITION_TYPES', () => {
  it('is Record-complete over the canonical AuditionType union', () => {
    expect(Object.keys(AUDITION_TYPES).sort()).toEqual([...AuditionTypeSchema.options].sort());
  });

  it('carries the settled on-screen labels', () => {
    expect(AUDITION_TYPES.platformAudition.label).toBe('Platform');
    expect(AUDITION_TYPES.sponsoredAudition.label).toBe('Sponsored');
    expect(AUDITION_TYPES.workAudition.label).toBe('Work');
  });

  it('gives every type a non-empty description', () => {
    for (const type of AuditionTypeSchema.options) {
      expect(AUDITION_TYPES[type].description.length).toBeGreaterThan(0);
    }
  });

  it('uses only settled user-facing terminology (no compound or retired terms)', () => {
    // UI copy uses the SHORT settled terms; the compound identifiers and the retired
    // vocabulary must never leak into a rendered string (ARCH-107).
    const retired = ['owner', 'member', 'project', 'opportunity', 'skill', 'universe'];
    for (const type of AuditionTypeSchema.options) {
      const copy = `${AUDITION_TYPES[type].label} ${AUDITION_TYPES[type].description}`.toLowerCase();
      for (const word of retired) {
        expect(copy, `'${word}' appears in the ${type} copy`).not.toContain(word);
      }
    }
  });
});

describe('AUDITION_TYPE_FILTER_ALL', () => {
  it('is the canonical ALL sentinel and doubles as its chip label', () => {
    expect(AUDITION_TYPE_FILTER_ALL).toBe('All');
  });

  it('can never collide with a canonical audition type', () => {
    expect([...AuditionTypeSchema.options]).not.toContain(AUDITION_TYPE_FILTER_ALL);
  });

  it('AuditionTypeFilter accepts the sentinel and every audition type', () => {
    const filters: AuditionTypeFilter[] = [
      AUDITION_TYPE_FILTER_ALL,
      ...AuditionTypeSchema.options,
    ];
    expect(filters).toHaveLength(AuditionTypeSchema.options.length + 1);
  });
});

describe('audition sort keys', () => {
  it('offers a sort set for the default feed and for every audition type', () => {
    expect(Object.keys(AUDITION_SORT_OPTIONS).sort()).toEqual(
      ['default', ...AuditionTypeSchema.options].sort(),
    );
  });

  it('defaults to newest, which every feed offers', () => {
    expect(DEFAULT_AUDITION_SORT).toBe('newest');
    for (const feed of Object.values(AUDITION_SORT_OPTIONS)) {
      expect(Object.keys(feed)).toContain(DEFAULT_AUDITION_SORT);
    }
  });

  it('shares ONE declaration of the newest/endingSoon pair across every feed', () => {
    // The pair used to be restated verbatim in all four feed entries; it is now spread from a
    // single base declaration. This pins VALUE equality, so a future edit that reintroduces a
    // per-feed copy of either option (and drifts its label/field/direction) fails here.
    const base = AUDITION_SORT_OPTIONS.default;
    for (const [feed, options] of Object.entries(AUDITION_SORT_OPTIONS)) {
      expect(options.newest, `${feed}.newest drifted from the shared base pair`).toEqual(base.newest);
      expect(options.endingSoon, `${feed}.endingSoon drifted from the shared base pair`).toEqual(
        base.endingSoon,
      );
    }
  });

  it('pins the shared pair to the settled labels + sort fields', () => {
    expect(AUDITION_SORT_OPTIONS.default.newest).toEqual({
      label: 'Newest First',
      field: 'createdOn',
      direction: 'desc',
    });
    expect(AUDITION_SORT_OPTIONS.default.endingSoon).toEqual({
      label: 'Ending Soon',
      field: 'openTill',
      direction: 'asc',
    });
  });

  it('platformAudition stays an exact copy of the default set (the by-type lookup must be total)', () => {
    // `AUDITION_SORT_OPTIONS[filter]` is indexed by the canonical AuditionType, so platform
    // auditions need an entry even though they offer nothing beyond the shared pair.
    expect(AUDITION_SORT_OPTIONS.platformAudition).toEqual(AUDITION_SORT_OPTIONS.default);
  });

  it('AuditionSortKey derives exactly the six declared sort keys', () => {
    const declared = new Set(
      Object.values(AUDITION_SORT_OPTIONS).flatMap((feed) => Object.keys(feed)),
    );
    expect([...declared].sort()).toEqual([
      'endingSoon',
      'highestPrice',
      'highestStakeShares',
      'lowestPrice',
      'lowestStakeShares',
      'newest',
    ]);
    // Compile-checked: the shared pair's keys are still members of the derived union.
    const sharedPairKeys: AuditionSortKey[] = ['newest', 'endingSoon'];
    for (const key of sharedPairKeys) expect(declared.has(key)).toBe(true);
  });

  it('AuditionSortKey spans every feed, not just the default one', () => {
    // The failure this guards: deriving the union from AUDITION_SORT_OPTIONS.default only,
    // which silently rejects the type-specific keys. These two are declared on exactly one
    // feed each, so a narrowed derivation fails to compile right here. Their presence in the
    // options is then asserted at runtime.
    const sponsoredOnly: AuditionSortKey = 'highestPrice';
    const workOnly: AuditionSortKey = 'highestStakeShares';
    expect(Object.keys(AUDITION_SORT_OPTIONS.sponsoredAudition)).toContain(sponsoredOnly);
    expect(Object.keys(AUDITION_SORT_OPTIONS.workAudition)).toContain(workOnly);
  });
});
