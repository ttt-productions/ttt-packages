// RealmCanonStatus — the ONE declaration of a Work's standing inside its Realm (ARCH-102).
// Both Work document shapes carry the same schema object, and it stays distinct from the
// realm FILE approval gate, which is a different concept with two extra states.

import { describe, it, expect } from 'vitest';
import {
  RealmCanonStatusSchema,
  FullWorkProjectSchema,
  PublicWorkProjectSchema,
} from '../src/doc-schemas/work-project';
import { RealmFileCanonStatusSchema } from '../src/doc-schemas/media-assets';

describe('RealmCanonStatusSchema', () => {
  it('is the schema object both Work shapes use for realmCanonStatus', () => {
    expect(FullWorkProjectSchema.shape.realmCanonStatus).toBe(RealmCanonStatusSchema);
    expect(PublicWorkProjectSchema.shape.realmCanonStatus).toBe(RealmCanonStatusSchema);
  });

  it('accepts the canon standings and nothing else', () => {
    for (const value of RealmCanonStatusSchema.options) {
      expect(RealmCanonStatusSchema.safeParse(value).success).toBe(true);
    }
    expect(RealmCanonStatusSchema.safeParse('none').success).toBe(false);
    expect(RealmCanonStatusSchema.safeParse('pendingApproval').success).toBe(false);
  });

  it('is a narrower vocabulary than the realm FILE approval gate', () => {
    const fileOptions = new Set<string>(RealmFileCanonStatusSchema.options);
    for (const value of RealmCanonStatusSchema.options) expect(fileOptions.has(value)).toBe(true);
    expect(RealmFileCanonStatusSchema.options.length).toBeGreaterThan(
      RealmCanonStatusSchema.options.length,
    );
  });
});
