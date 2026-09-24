import { describe, it, expect } from 'vitest';
import { SPECIAL_DOCS } from '../src/paths/collections';
import {
  EMPTY_PUBLIC_DOCUMENT_VERSION_BLOCK,
  planPublicDocumentRelease,
  currentPublicDocumentVersion,
  requiredPublicDocumentAcceptanceLevel,
  isPublicDocumentAcceptanceRequired,
  changedPublicDocuments,
  samePublicDocumentVersions,
  publicDocumentAcceptanceSummary,
  buildPublicDocumentProjection,
  publicDocumentContentEquals,
  requiredPublicDocumentVersion,
  squareStreetzAgreementsSatisfied,
} from '../src/utils/public-documents';
import {
  PublicDocumentVersionBlockSchema,
  PublicDocumentAcceptanceSchema,
  PUBLIC_DOCUMENT_PROJECTION_SCHEMAS,
  type PublicDocumentContent,
  type PublicDocumentVersionBlock,
} from '../src/doc-schemas/public-documents';

const TERMS = SPECIAL_DOCS.TERMS_PAGE;
const PRIVACY = SPECIAL_DOCS.PRIVACY_PAGE;
const RULES = SPECIAL_DOCS.RULES_AND_AGREEMENTS;
const PLANS = SPECIAL_DOCS.FUTURE_PLANS;
const DMCA = SPECIAL_DOCS.DMCA_POLICY;
const TAKE_IT_DOWN = SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY;

const accept = (block: Parameters<typeof publicDocumentAcceptanceSummary>[0]) =>
  publicDocumentAcceptanceSummary(block, { acceptedAt: 1, legalReviewNoticeRevision: 'founder-note-v1' });

describe('planPublicDocumentRelease — the one version-assignment rule', () => {
  it('first release of a document is v1; a required release raises the level to 1', () => {
    const plan = planPublicDocumentRelease(undefined, [TERMS, PRIVACY], true);
    expect(plan.documents).toEqual([
      { documentId: TERMS, version: 1 },
      { documentId: PRIVACY, version: 1 },
    ]);
    expect(plan.requiredAcceptanceLevel).toBe(1);
    expect(plan.block).toEqual({
      documents: {
        [TERMS]: { currentVersion: 1, requiredVersion: 1 },
        [PRIVACY]: { currentVersion: 1, requiredVersion: 1 },
      },
      requiredAcceptanceLevel: 1,
    });
    expect(PublicDocumentVersionBlockSchema.safeParse(plan.block).success).toBe(true);
  });

  it('a release that does not require acceptance bumps versions only', () => {
    const first = planPublicDocumentRelease(undefined, [TERMS], true);
    const second = planPublicDocumentRelease(first.block, [TERMS], false);
    expect(second.documents).toEqual([{ documentId: TERMS, version: 2 }]);
    expect(second.requiredAcceptanceLevel).toBe(1);
    expect(second.block.documents[TERMS]).toEqual({ currentVersion: 2, requiredVersion: 1 });
  });

  it('touches only the released documents and raises the level by exactly one per requiring release', () => {
    const a = planPublicDocumentRelease(undefined, [TERMS, RULES], true);
    const b = planPublicDocumentRelease(a.block, [RULES], true);
    expect(b.block.documents[TERMS]).toEqual({ currentVersion: 1, requiredVersion: 1 });
    expect(b.block.documents[RULES]).toEqual({ currentVersion: 2, requiredVersion: 2 });
    expect(b.requiredAcceptanceLevel).toBe(2);
  });

  it('assigns versions in canonical order regardless of the listed order', () => {
    const plan = planPublicDocumentRelease(undefined, [TAKE_IT_DOWN, DMCA, TERMS], false);
    expect(plan.documents.map((ref) => ref.documentId)).toEqual([TERMS, DMCA, TAKE_IT_DOWN]);
  });

  it('never mutates the block it was given', () => {
    const a = planPublicDocumentRelease(undefined, [TERMS], true);
    const snapshot = JSON.stringify(a.block);
    planPublicDocumentRelease(a.block, [TERMS, PLANS], true);
    expect(JSON.stringify(a.block)).toBe(snapshot);
    expect(EMPTY_PUBLIC_DOCUMENT_VERSION_BLOCK).toEqual({ documents: {}, requiredAcceptanceLevel: 0 });
  });

  it('refuses an empty or duplicated document list', () => {
    expect(() => planPublicDocumentRelease(undefined, [], true)).toThrow();
    expect(() => planPublicDocumentRelease(undefined, [TERMS, TERMS], true)).toThrow();
  });

  it('reads a missing block as version 0 / level 0', () => {
    expect(currentPublicDocumentVersion(undefined, TERMS)).toBe(0);
    expect(requiredPublicDocumentAcceptanceLevel(undefined)).toBe(0);
    expect(currentPublicDocumentVersion(EMPTY_PUBLIC_DOCUMENT_VERSION_BLOCK, DMCA)).toBe(0);
  });
});

describe('re-acceptance: who is asked, and what they are shown', () => {
  it('a no-prompt release then a required release: prompted only after the required one, shown both changes', () => {
    const launch = planPublicDocumentRelease(undefined, [TERMS, PRIVACY, RULES], true);
    const user = accept(launch.block);
    expect(isPublicDocumentAcceptanceRequired(launch.block, user)).toBe(false);

    const quiet = planPublicDocumentRelease(launch.block, [PRIVACY], false);
    expect(isPublicDocumentAcceptanceRequired(quiet.block, user)).toBe(false);
    // Not prompted — but the quiet change is still newer than what they accepted.
    expect(changedPublicDocuments(quiet.block, user)).toEqual([{ documentId: PRIVACY, version: 2 }]);

    const required = planPublicDocumentRelease(quiet.block, [TERMS], true);
    expect(isPublicDocumentAcceptanceRequired(required.block, user)).toBe(true);
    expect(changedPublicDocuments(required.block, user)).toEqual([
      { documentId: TERMS, version: 2 },
      { documentId: PRIVACY, version: 2 },
    ]);
  });

  it('two missed releases list every changed document once, at its CURRENT version', () => {
    const launch = planPublicDocumentRelease(undefined, [TERMS, RULES], true);
    const user = accept(launch.block);
    const r2 = planPublicDocumentRelease(launch.block, [TERMS, RULES], true);
    const r3 = planPublicDocumentRelease(r2.block, [TERMS, DMCA], true);
    expect(changedPublicDocuments(r3.block, user)).toEqual([
      { documentId: TERMS, version: 3 },
      { documentId: RULES, version: 2 },
      { documentId: DMCA, version: 1 },
    ]);
    expect(isPublicDocumentAcceptanceRequired(r3.block, user)).toBe(true);
  });

  it('accepting everything current clears the prompt and the change list', () => {
    const r1 = planPublicDocumentRelease(undefined, [TERMS, RULES], true);
    const r2 = planPublicDocumentRelease(r1.block, [RULES], true);
    const user = accept(r2.block);
    expect(user).toEqual({
      documentVersions: { [TERMS]: 1, [RULES]: 2 },
      acceptedLevel: 2,
      legalReviewNoticeRevision: 'founder-note-v1',
      acceptedAt: 1,
    });
    expect(PublicDocumentAcceptanceSchema.safeParse(user).success).toBe(true);
    expect(isPublicDocumentAcceptanceRequired(r2.block, user)).toBe(false);
    expect(changedPublicDocuments(r2.block, user)).toEqual([]);
  });

  it('a person with no summary is at level 0 and has accepted nothing', () => {
    const r1 = planPublicDocumentRelease(undefined, [TERMS], true);
    expect(isPublicDocumentAcceptanceRequired(r1.block, undefined)).toBe(true);
    expect(changedPublicDocuments(r1.block, undefined)).toEqual([{ documentId: TERMS, version: 1 }]);
  });

  it('first-admin bootstrap: registering before any release records nothing and is never prompted', () => {
    const summary = publicDocumentAcceptanceSummary(undefined, { acceptedAt: 1, legalReviewNoticeRevision: null });
    expect(summary).toEqual({ documentVersions: {}, acceptedLevel: 0, acceptedAt: 1 });
    expect(isPublicDocumentAcceptanceRequired(undefined, summary)).toBe(false);
  });

  it('a publish racing the prompt is detected by comparing what it showed with what is current', () => {
    const r1 = planPublicDocumentRelease(undefined, [TERMS, RULES], true);
    const r2 = planPublicDocumentRelease(r1.block, [TERMS], true);
    const user = accept(r1.block);
    const shown = changedPublicDocuments(r2.block, user);
    expect(samePublicDocumentVersions(shown, changedPublicDocuments(r2.block, user))).toBe(true);

    const raced = planPublicDocumentRelease(r2.block, [RULES], false);
    expect(samePublicDocumentVersions(shown, changedPublicDocuments(raced.block, user))).toBe(false);
  });
});

describe('samePublicDocumentVersions', () => {
  it('ignores order', () => {
    expect(
      samePublicDocumentVersions(
        [
          { documentId: TERMS, version: 2 },
          { documentId: RULES, version: 1 },
        ],
        [
          { documentId: RULES, version: 1 },
          { documentId: TERMS, version: 2 },
        ],
      ),
    ).toBe(true);
  });

  it('distinguishes versions, extra documents, and duplicates', () => {
    expect(samePublicDocumentVersions([{ documentId: TERMS, version: 2 }], [{ documentId: TERMS, version: 3 }])).toBe(
      false,
    );
    expect(samePublicDocumentVersions([], [{ documentId: TERMS, version: 1 }])).toBe(false);
    expect(
      samePublicDocumentVersions(
        [
          { documentId: TERMS, version: 1 },
          { documentId: TERMS, version: 1 },
        ],
        [
          { documentId: TERMS, version: 1 },
          { documentId: RULES, version: 1 },
        ],
      ),
    ).toBe(false);
  });
});

describe('squareStreetzAgreementsSatisfied — the one Square agreements rule', () => {
  // Rules v3 is current; v2 is the latest version a release required acceptance of.
  const block: PublicDocumentVersionBlock = {
    documents: { [RULES]: { currentVersion: 3, requiredVersion: 2 }, [TERMS]: { currentVersion: 5, requiredVersion: 5 } },
    requiredAcceptanceLevel: 4,
  };
  const recorded = (version: number | undefined) => ({
    squareStreetzAgreementsDate: 1_700_000_000_000,
    squareStreetzAgreementsVersion: version,
  });

  it('reads the Rules document’s required version from the block (0 when absent)', () => {
    expect(requiredPublicDocumentVersion(block, RULES)).toBe(2);
    expect(requiredPublicDocumentVersion(block, PRIVACY)).toBe(0);
    expect(requiredPublicDocumentVersion(undefined, RULES)).toBe(0);
  });

  it('refuses a missing acceptance date', () => {
    expect(squareStreetzAgreementsSatisfied({ squareStreetzAgreementsVersion: 3 }, block)).toBe(false);
  });

  it('refuses a missing Rules version', () => {
    expect(squareStreetzAgreementsSatisfied({ squareStreetzAgreementsDate: 1 }, block)).toBe(false);
  });

  it('refuses a Rules version older than the latest required one', () => {
    expect(squareStreetzAgreementsSatisfied(recorded(1), block)).toBe(false);
  });

  it('accepts a Rules version equal to the latest required one', () => {
    expect(squareStreetzAgreementsSatisfied(recorded(2), block)).toBe(true);
  });

  it('accepts a newer Rules version (a later release that did not require acceptance never re-asks)', () => {
    expect(squareStreetzAgreementsSatisfied(recorded(3), block)).toBe(true);
  });

  it('with no version block, needs only a recorded date and version (0 is the pre-release sentinel)', () => {
    expect(squareStreetzAgreementsSatisfied(recorded(0), undefined)).toBe(true);
    expect(squareStreetzAgreementsSatisfied(recorded(undefined), undefined)).toBe(false);
    expect(squareStreetzAgreementsSatisfied({ squareStreetzAgreementsVersion: 0 }, undefined)).toBe(false);
  });

  it('with a block that has no Rules entry, needs only a recorded date and version', () => {
    const noRules: PublicDocumentVersionBlock = {
      documents: { [TERMS]: { currentVersion: 1, requiredVersion: 1 } },
      requiredAcceptanceLevel: 1,
    };
    expect(squareStreetzAgreementsSatisfied(recorded(0), noRules)).toBe(true);
  });

  it('refuses when there is no private data at all', () => {
    expect(squareStreetzAgreementsSatisfied(undefined, block)).toBe(false);
    expect(squareStreetzAgreementsSatisfied(null, undefined)).toBe(false);
  });

  it('ignores other documents’ required versions', () => {
    // Terms requires v5, but only the Rules page is incorporated by the Square card.
    expect(squareStreetzAgreementsSatisfied(recorded(2), block)).toBe(true);
  });
});

describe('current projection and the unchanged-draft rule', () => {
  it('the projection is the content plus version and publish time, valid for its page schema', () => {
    const content: PublicDocumentContent<typeof TERMS> = {
      sections: [{ id: 's', heading: 'H', level: 1, body: 'B', order: 0 }],
    };
    const projection = buildPublicDocumentProjection<typeof TERMS>(content, 4, 99);
    expect(projection).toEqual({ ...content, version: 4, lastUpdated: 99 });
    expect(PUBLIC_DOCUMENT_PROJECTION_SCHEMAS[TERMS].safeParse(projection).success).toBe(true);

    const rules = buildPublicDocumentProjection<typeof RULES>({ rules: [], agreements: {} }, 2, 99);
    expect(PUBLIC_DOCUMENT_PROJECTION_SCHEMAS[RULES].parse(rules)).toEqual(rules);
  });

  it('content equality ignores field order and absent-vs-undefined, but not words', () => {
    const a: PublicDocumentContent<typeof PLANS> = {
      plans: [{ id: 'p', title: 'T', description: 'D', order: 0 }],
    };
    const reordered = { plans: [{ order: 0, description: 'D', title: 'T', id: 'p', videoUrl: undefined }] };
    const edited = { plans: [{ id: 'p', title: 'T', description: 'D!', order: 0 }] };
    expect(publicDocumentContentEquals<typeof PLANS>(a, reordered)).toBe(true);
    expect(publicDocumentContentEquals<typeof PLANS>(a, edited)).toBe(false);
    expect(publicDocumentContentEquals<typeof PLANS>(a, { plans: [...a.plans, ...a.plans] })).toBe(false);
  });
});
