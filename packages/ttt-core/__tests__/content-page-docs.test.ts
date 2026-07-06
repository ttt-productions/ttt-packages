import { describe, it, expect } from 'vitest';
import {
  LegalPageDocumentSchema,
  TakeItDownPageCopySchema,
  FuturePlansDocumentSchema,
  RulesAndAgreementsSchema,
} from '../src/doc-schemas/content';
import {
  UpdateTermsPageInputSchema,
  UpdatePrivacyPageInputSchema,
  UpdateTakeItDownPageCopyInputSchema,
} from '../src/schemas/admin';
import { PATH_BUILDERS, SPECIAL_DOCS } from '../src/paths';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';

const section = { id: 's1', heading: 'Part 1', level: 1, body: 'First paragraph.\n\nSecond paragraph.', order: 0 };

describe('content-page doc schemas (content-pages migration)', () => {
  it('LegalPageDocumentSchema requires version + lastUpdated + sections', () => {
    expect(LegalPageDocumentSchema.safeParse({
      version: 1,
      lastUpdated: 1751000000000,
      sections: [section, { ...section, id: 's2', level: 2, order: 1 }],
    }).success).toBe(true);
    // New docs are seeded with version from birth — it is required.
    expect(LegalPageDocumentSchema.safeParse({
      lastUpdated: 1751000000000,
      sections: [section],
    }).success).toBe(false);
  });

  it('TakeItDownPageCopySchema is a versioned keyed-strings map', () => {
    expect(TakeItDownPageCopySchema.safeParse({
      version: 1,
      lastUpdated: 1751000000000,
      strings: { pageTitle: 'Take It Down', introBody: 'Report non-consensual intimate imagery.' },
    }).success).toBe(true);
    expect(TakeItDownPageCopySchema.safeParse({
      lastUpdated: 1751000000000,
      strings: {},
    }).success).toBe(false);
  });

  it('existing FuturePlans / RulesAndAgreements docs still parse WITHOUT version (pre-migration data)', () => {
    expect(FuturePlansDocumentSchema.safeParse({
      lastUpdated: 1751000000000,
      plans: [],
    }).success).toBe(true);
    expect(RulesAndAgreementsSchema.safeParse({
      rules: [],
      agreements: {},
    }).success).toBe(true);
    // ...and WITH version once the migration bumps them.
    expect(FuturePlansDocumentSchema.safeParse({
      lastUpdated: 1751000000000,
      plans: [],
      version: 3,
    }).success).toBe(true);
  });

  it('registers the three _config singletons in COLLECTION_SCHEMAS', () => {
    expect(COLLECTION_SCHEMAS['_config/termsOfService']).toBe(LegalPageDocumentSchema);
    expect(COLLECTION_SCHEMAS['_config/privacyPolicy']).toBe(LegalPageDocumentSchema);
    expect(COLLECTION_SCHEMAS['_config/takeItDownPageCopy']).toBe(TakeItDownPageCopySchema);
  });

  it('builds the _config paths', () => {
    expect(PATH_BUILDERS.termsPage()).toEqual(['_config', SPECIAL_DOCS.TERMS_PAGE]);
    expect(PATH_BUILDERS.privacyPage()).toEqual(['_config', SPECIAL_DOCS.PRIVACY_PAGE]);
    expect(PATH_BUILDERS.takeItDownPageCopy()).toEqual(['_config', SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]);
  });
});

describe('content-page update-callable input schemas', () => {
  it('accepts a valid sections payload and rejects extra keys / version smuggling', () => {
    expect(UpdateTermsPageInputSchema.safeParse({ sections: [section] }).success).toBe(true);
    expect(UpdatePrivacyPageInputSchema.safeParse({ sections: [section] }).success).toBe(true);
    // `version` is server-bumped — a client sending it is rejected (strict).
    expect(UpdateTermsPageInputSchema.safeParse({ sections: [section], version: 99 }).success).toBe(false);
    // Empty sections would blank a legal page — rejected.
    expect(UpdateTermsPageInputSchema.safeParse({ sections: [] }).success).toBe(false);
  });

  it('take-it-down strings input enforces the 1–200 entry bound and strictness', () => {
    expect(UpdateTakeItDownPageCopyInputSchema.safeParse({
      strings: { pageTitle: 'Take It Down' },
    }).success).toBe(true);
    expect(UpdateTakeItDownPageCopyInputSchema.safeParse({ strings: {} }).success).toBe(false);
    const tooMany: Record<string, string> = {};
    for (let i = 0; i < 201; i++) tooMany[`k${i}`] = 'v';
    expect(UpdateTakeItDownPageCopyInputSchema.safeParse({ strings: tooMany }).success).toBe(false);
    expect(UpdateTakeItDownPageCopyInputSchema.safeParse({
      strings: { pageTitle: 'x' },
      version: 2,
    }).success).toBe(false);
  });
});
