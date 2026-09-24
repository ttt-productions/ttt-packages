import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  PUBLIC_DOCUMENT_IDS,
  PUBLIC_DOCUMENT_LABELS,
  PUBLIC_DOCUMENTS_ACCEPTED_CLAIM,
  PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT,
  type PublicDocumentId,
} from '../src/constants/public-documents';
import * as root from '../src/index';
import { COLLECTIONS, NESTED_SUBCOLLECTIONS, SPECIAL_DOCS } from '../src/paths/collections';
import { PATH_BUILDERS, publicDocumentVersionDocId } from '../src/paths/path-builders';
import { COLLECTION_REFS } from '../src/paths/collection-refs';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';
import {
  PublicDocumentVersionSchema,
  PublicDocumentDraftSchema,
  PublicDocumentReleaseSchema,
  PublicDocumentVersionBlockSchema,
  PublicDocumentAcceptanceSchema,
  PUBLIC_DOCUMENT_CONTENT_SCHEMAS,
  PUBLIC_DOCUMENT_PROJECTION_SCHEMAS,
  type PublicDocumentVersion,
  type PublicDocumentProjection,
} from '../src/doc-schemas/public-documents';
import {
  DmcaPolicyDocumentSchema,
  LegalPageDocumentSchema,
  ThresholdItemSchema,
  type LegalPageDocument,
  type RulesAndAgreements,
} from '../src/doc-schemas/content';
import { AppConfigSchema } from '../src/doc-schemas/system';
import { FullUserSchema, UserPrivateDataSchema } from '../src/doc-schemas/user';
import { PledgePaymentProviderRefSchema } from '../src/doc-schemas/payments';
import {
  SavePublicDocumentDraftInputSchema,
  PublishPublicDocumentReleaseInputSchema,
  AcceptPublicDocumentsInputSchema,
  AcceptPublicDocumentsResultSchema,
  ReadPublicDocumentHistoryInputSchema,
  PublicDocumentsReleasedAuditPayloadSchema,
  PublicDocumentsAcceptedAuditPayloadSchema,
} from '../src/schemas/public-documents';
import {
  RegisterUserInputSchema,
  RegisterUserResultSchema,
  SquareStreetzAgreementsAcceptedAuditPayloadSchema,
} from '../src/schemas/users';
import { PublicDocumentVersionOrNoneSchema } from '../src/doc-schemas/public-documents';
import * as docSchemasBarrel from '../src/doc-schemas';
import { changedPublicDocuments, planPublicDocumentRelease, samePublicDocumentVersions } from '../src/utils/public-documents';
import { CreateStripeCheckoutSessionInputSchema } from '../src/schemas/payments';
import { SubmitForThresholdLibraryReviewInputSchema } from '../src/schemas/hall-library';
import * as schemasBarrel from '../src/schemas';

const TERMS = SPECIAL_DOCS.TERMS_PAGE;
const RULES = SPECIAL_DOCS.RULES_AND_AGREEMENTS;
const DMCA = SPECIAL_DOCS.DMCA_POLICY;
const section = { id: 's1', heading: 'Part 1', level: 1 as const, body: 'Body.', order: 0 };
const dmcaContent = {
  intro: 'Information for reporting copyright infringement.',
  contactBlocks: [
    {
      id: 'agent',
      heading: 'Designated Agent Information',
      order: 0,
      rows: [{ id: 'email', label: 'Email', value: 'agent@example.com', order: 0 }],
    },
  ],
  sections: [section],
};
const RELEASE_ID = '8f14e45f-ceea-467a-9a8b-9a1b1c2d3e4f';

describe('public document identity', () => {
  it('each id is its _appConfig projection doc id', () => {
    expect(PUBLIC_DOCUMENT_IDS).toEqual([
      SPECIAL_DOCS.TERMS_PAGE,
      SPECIAL_DOCS.PRIVACY_PAGE,
      SPECIAL_DOCS.RULES_AND_AGREEMENTS,
      SPECIAL_DOCS.FUTURE_PLANS,
      SPECIAL_DOCS.DMCA_POLICY,
      SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY,
    ]);
    expect(PATH_BUILDERS.publicDocumentProjection(TERMS)).toEqual(PATH_BUILDERS.termsPage());
    expect(PATH_BUILDERS.publicDocumentProjection(SPECIAL_DOCS.PRIVACY_PAGE)).toEqual(PATH_BUILDERS.privacyPage());
    expect(PATH_BUILDERS.publicDocumentProjection(RULES)).toEqual(PATH_BUILDERS.rulesAndAgreements());
    expect(PATH_BUILDERS.publicDocumentProjection(SPECIAL_DOCS.FUTURE_PLANS)).toEqual(PATH_BUILDERS.futurePlans());
    expect(PATH_BUILDERS.publicDocumentProjection(SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY)).toEqual(
      PATH_BUILDERS.takeItDownPageCopy(),
    );
    expect(PATH_BUILDERS.publicDocumentProjection(DMCA)).toEqual(PATH_BUILDERS.dmcaPolicy());
  });

  it('labels every document', () => {
    for (const id of PUBLIC_DOCUMENT_IDS) expect(PUBLIC_DOCUMENT_LABELS[id].length, id).toBeGreaterThan(0);
    expect(PUBLIC_DOCUMENT_LABELS[TERMS]).toBe('Terms of Service');
    expect(PUBLIC_DOCUMENT_LABELS[SPECIAL_DOCS.PRIVACY_PAGE]).toBe('Privacy Policy');
  });

  it('names the acceptance claim once', () => {
    expect(PUBLIC_DOCUMENTS_ACCEPTED_CLAIM).toBe('docsAccepted');
  });

  it("states the re-acceptance prompt's agreement line verbatim, on the server-safe root", () => {
    expect(PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT).toBe(
      'By choosing Accept, you agree to the current versions of the documents listed above.',
    );
    expect(root.PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT).toBe(PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT);
  });

  it('has a content and a projection schema for every document', () => {
    for (const id of PUBLIC_DOCUMENT_IDS) {
      expect(PUBLIC_DOCUMENT_CONTENT_SCHEMAS[id], id).toBeDefined();
      expect(PUBLIC_DOCUMENT_PROJECTION_SCHEMAS[id], id).toBeDefined();
    }
  });
});

describe('public document paths', () => {
  it('builds the immutable version, working copy, and release paths', () => {
    expect(PATH_BUILDERS.publicDocumentVersion(TERMS, 3)).toEqual([
      COLLECTIONS.PUBLIC_DOCUMENTS,
      TERMS,
      NESTED_SUBCOLLECTIONS.PUBLIC_DOCUMENT_VERSIONS,
      'v3',
    ]);
    expect(PATH_BUILDERS.publicDocumentDraft(DMCA)).toEqual([COLLECTIONS.PUBLIC_DOCUMENT_DRAFTS, DMCA]);
    expect(PATH_BUILDERS.publicDocumentRelease(RELEASE_ID)).toEqual([
      COLLECTIONS.PUBLIC_DOCUMENT_RELEASES,
      RELEASE_ID,
    ]);
    expect(COLLECTION_REFS.publicDocumentVersions(RULES)).toEqual([
      COLLECTIONS.PUBLIC_DOCUMENTS,
      RULES,
      NESTED_SUBCOLLECTIONS.PUBLIC_DOCUMENT_VERSIONS,
    ]);
  });

  it('version doc ids are whole numbers from 1', () => {
    expect(publicDocumentVersionDocId(1)).toBe('v1');
    expect(() => publicDocumentVersionDocId(0)).toThrow();
    expect(() => publicDocumentVersionDocId(1.5)).toThrow();
  });

  it('registers every public-document collection and the DMCA projection', () => {
    expect(COLLECTION_SCHEMAS['publicDocuments/{documentId}/publicDocumentVersions/{versionId}']).toBe(
      PublicDocumentVersionSchema,
    );
    expect(COLLECTION_SCHEMAS['publicDocumentDrafts/{documentId}']).toBe(PublicDocumentDraftSchema);
    expect(COLLECTION_SCHEMAS['publicDocumentReleases/{releaseId}']).toBe(PublicDocumentReleaseSchema);
    expect(COLLECTION_SCHEMAS['_appConfig/dmcaPolicy']).toBe(DmcaPolicyDocumentSchema);
  });
});

describe('immutable version document', () => {
  const version = {
    documentId: TERMS,
    content: { sections: [section] },
    version: 2,
    releaseId: RELEASE_ID,
    publishedBy: 'admin-uid',
    publishedAt: 1_760_000_000_000,
  };

  it('holds the full content, version, release, publisher, and time', () => {
    expect(PublicDocumentVersionSchema.safeParse(version).success).toBe(true);
  });

  it('validates the content by its document', () => {
    expect(
      PublicDocumentVersionSchema.safeParse({ ...version, content: { rules: [], agreements: {} } }).success,
    ).toBe(false);
    expect(
      PublicDocumentVersionSchema.safeParse({ ...version, documentId: DMCA, content: dmcaContent }).success,
    ).toBe(true);
  });

  it('versions are whole numbers from v1', () => {
    expect(PublicDocumentVersionSchema.safeParse({ ...version, version: 0 }).success).toBe(false);
    expect(PublicDocumentVersionSchema.safeParse({ ...version, version: 1.5 }).success).toBe(false);
  });

  it('rejects an unknown document', () => {
    expect(PublicDocumentVersionSchema.safeParse({ ...version, documentId: 'cookiePolicy' }).success).toBe(false);
  });

  it('types the content by document id', () => {
    const doc = version as PublicDocumentVersion;
    if (doc.documentId === TERMS) {
      expectTypeOf(doc.content.sections).toBeArray();
    }
  });
});

describe('working copy and release record', () => {
  it('a working copy records the version its edit started from (0 = never published)', () => {
    const draft = {
      documentId: RULES,
      content: { rules: [], agreements: {} },
      baseVersion: 0,
      savedBy: 'admin-uid',
      savedAt: 1,
    };
    expect(PublicDocumentDraftSchema.safeParse(draft).success).toBe(true);
    expect(PublicDocumentDraftSchema.safeParse({ ...draft, baseVersion: -1 }).success).toBe(false);
  });

  it('a release names at least one document/version pair', () => {
    const release = {
      releaseId: RELEASE_ID,
      documents: [{ documentId: TERMS, version: 2 }],
      requireAcceptance: true,
      requiredAcceptanceLevel: 1,
      publishedBy: 'admin-uid',
      publishedAt: 1,
    };
    expect(PublicDocumentReleaseSchema.safeParse(release).success).toBe(true);
    expect(PublicDocumentReleaseSchema.safeParse({ ...release, documents: [] }).success).toBe(false);
  });
});

describe('version block on _appConfig/app', () => {
  const block = {
    documents: { [TERMS]: { currentVersion: 3, requiredVersion: 2 } },
    requiredAcceptanceLevel: 2,
  };

  it('AppConfig carries it, and still parses without it', () => {
    const base = { appVersion: '1.0.0', maintenanceMode: false, registrationEnabled: true };
    expect(AppConfigSchema.safeParse(base).success).toBe(true);
    expect(AppConfigSchema.safeParse({ ...base, publicDocumentVersions: block }).success).toBe(true);
  });

  it('a required version can never pass the current version', () => {
    expect(
      PublicDocumentVersionBlockSchema.safeParse({
        ...block,
        documents: { [TERMS]: { currentVersion: 1, requiredVersion: 2 } },
      }).success,
    ).toBe(false);
  });

  it('accepts only known documents, and a document never published simply has no entry', () => {
    expect(PublicDocumentVersionBlockSchema.safeParse({ documents: {}, requiredAcceptanceLevel: 0 }).success).toBe(
      true,
    );
    expect(
      PublicDocumentVersionBlockSchema.safeParse({
        documents: { cookiePolicy: { currentVersion: 1, requiredVersion: 0 } },
        requiredAcceptanceLevel: 0,
      }).success,
    ).toBe(false);
  });
});

describe('private acceptance summary', () => {
  const summary = {
    documentVersions: { [TERMS]: 3, [RULES]: 1 },
    acceptedLevel: 2,
    legalReviewNoticeRevision: 'founder-note-v1',
    acceptedAt: 1,
  };

  it('lives on privateData beside the kept registration agreements', () => {
    const { shape } = UserPrivateDataSchema;
    expect(shape.publicDocumentAcceptance.safeParse(summary).success).toBe(true);
    expect(shape.publicDocumentAcceptance.safeParse(undefined).success).toBe(true);
    // The registration fields stay compatible.
    expect(
      shape.agreements.safeParse({ age: true, terms: true, agreedOn: 1, termsVersion: 1, privacyVersion: 0 }).success,
    ).toBe(true);
  });

  it('is strict, and the notice revision is optional (absent while the notice was off)', () => {
    expect(PublicDocumentAcceptanceSchema.safeParse({ ...summary, history: [] }).success).toBe(false);
    const { legalReviewNoticeRevision: _omit, ...withoutNotice } = summary;
    expect(PublicDocumentAcceptanceSchema.safeParse(withoutNotice).success).toBe(true);
  });

  it('records the Artisan upgrade\'s Rules version', () => {
    const field = UserPrivateDataSchema.shape.artisanCreatorAgreementsVersion;
    expect(field.safeParse(4).success).toBe(true);
    expect(field.safeParse(0).success).toBe(true);
    expect(field.safeParse(-1).success).toBe(false);
  });

  it('records the Square agreements\' Rules version as the canonical version-or-none value', () => {
    const field = UserPrivateDataSchema.shape.squareStreetzAgreementsVersion;
    expect(field.safeParse(3).success).toBe(true);
    expect(field.safeParse(0).success).toBe(true);
    expect(field.safeParse(undefined).success).toBe(true);
    expect(field.safeParse(-1).success).toBe(false);
    expect(field.safeParse(1.5).success).toBe(false);
  });

  it('charterSignupMember is gone — Charter signup is derived from createdAt vs the flip', () => {
    expect(Object.keys(FullUserSchema.shape)).not.toContain('charterSignupMember');
  });
});

describe('current projection', () => {
  it('is assignable to the existing page document types', () => {
    expectTypeOf<PublicDocumentProjection<typeof TERMS>>().toMatchTypeOf<LegalPageDocument>();
    expectTypeOf<PublicDocumentProjection<typeof RULES>>().toMatchTypeOf<RulesAndAgreements>();
  });

  it('the DMCA projection is intro + contact blocks + sections, versioned', () => {
    expect(DmcaPolicyDocumentSchema.safeParse({ version: 1, lastUpdated: 1, ...dmcaContent }).success).toBe(true);
    expect(LegalPageDocumentSchema.safeParse({ version: 1, lastUpdated: 1, sections: [section] }).success).toBe(true);
  });
});

describe('callable inputs', () => {
  it('save draft validates each document\'s content by its own schema', () => {
    expect(
      SavePublicDocumentDraftInputSchema.safeParse({ documentId: TERMS, baseVersion: 1, content: { sections: [section] } })
        .success,
    ).toBe(true);
    expect(
      SavePublicDocumentDraftInputSchema.safeParse({ documentId: DMCA, baseVersion: 0, content: dmcaContent }).success,
    ).toBe(true);
    // Terms content under the Rules id.
    expect(
      SavePublicDocumentDraftInputSchema.safeParse({ documentId: RULES, baseVersion: 1, content: { sections: [section] } })
        .success,
    ).toBe(false);
    // The DMCA page exists to name the agent: at least one contact block.
    expect(
      SavePublicDocumentDraftInputSchema.safeParse({
        documentId: DMCA,
        baseVersion: 0,
        content: { ...dmcaContent, contactBlocks: [] },
      }).success,
    ).toBe(false);
  });

  it('save draft is strict — no version smuggling, full content only', () => {
    expect(
      SavePublicDocumentDraftInputSchema.safeParse({
        documentId: TERMS,
        baseVersion: 1,
        version: 9,
        content: { sections: [section] },
      }).success,
    ).toBe(false);
    // Rules content is the whole document — a partial (rules only) is rejected.
    expect(
      SavePublicDocumentDraftInputSchema.safeParse({ documentId: RULES, baseVersion: 1, content: { rules: [] } }).success,
    ).toBe(false);
  });

  it('publish names each document once, with a client-minted release id', () => {
    const input = { releaseId: RELEASE_ID, documentIds: [TERMS, DMCA], requireAcceptance: true };
    expect(PublishPublicDocumentReleaseInputSchema.safeParse(input).success).toBe(true);
    expect(PublishPublicDocumentReleaseInputSchema.safeParse({ ...input, documentIds: [TERMS, TERMS] }).success).toBe(
      false,
    );
    expect(PublishPublicDocumentReleaseInputSchema.safeParse({ ...input, documentIds: [] }).success).toBe(false);
    expect(PublishPublicDocumentReleaseInputSchema.safeParse({ ...input, releaseId: 'r1' }).success).toBe(false);
    const { requireAcceptance: _omit, ...withoutChoice } = input;
    expect(PublishPublicDocumentReleaseInputSchema.safeParse(withoutChoice).success).toBe(false);
  });

  it('accept carries only the document/version pairs the prompt showed', () => {
    expect(
      AcceptPublicDocumentsInputSchema.safeParse({ documents: [{ documentId: TERMS, version: 3 }] }).success,
    ).toBe(true);
    expect(AcceptPublicDocumentsInputSchema.safeParse({ documents: [] }).success).toBe(true);
    expect(
      AcceptPublicDocumentsInputSchema.safeParse({
        documents: [
          { documentId: TERMS, version: 3 },
          { documentId: TERMS, version: 2 },
        ],
      }).success,
    ).toBe(false);
    // The client never names a level, identity, or time.
    expect(
      AcceptPublicDocumentsInputSchema.safeParse({ documents: [], acceptedLevel: 5 }).success,
    ).toBe(false);
    expect(
      AcceptPublicDocumentsInputSchema.safeParse({ documents: [{ documentId: TERMS, version: 0 }] }).success,
    ).toBe(false);
  });

  it('accept answers accepted or refreshRequired', () => {
    expect(AcceptPublicDocumentsResultSchema.safeParse({ status: 'accepted', acceptedLevel: 2 }).success).toBe(true);
    expect(AcceptPublicDocumentsResultSchema.safeParse({ status: 'refreshRequired' }).success).toBe(true);
  });

  it('history pages newest-first by version', () => {
    expect(ReadPublicDocumentHistoryInputSchema.safeParse({ documentId: TERMS }).success).toBe(true);
    expect(ReadPublicDocumentHistoryInputSchema.safeParse({ documentId: TERMS, beforeVersion: null }).success).toBe(
      true,
    );
    expect(ReadPublicDocumentHistoryInputSchema.safeParse({ documentId: TERMS, beforeVersion: 0 }).success).toBe(false);
  });

  it('the old direct page-update schemas are gone — every change is a release', () => {
    for (const name of [
      'UpdateTermsPageInputSchema',
      'UpdatePrivacyPageInputSchema',
      'UpdateRulesAndAgreementsInputSchema',
      'UpdateFuturePlansInputSchema',
      'UpdateTakeItDownPageCopyInputSchema',
    ]) {
      expect(name in schemasBarrel, name).toBe(false);
    }
  });
});

describe('registration carries the versions the signup page showed', () => {
  const registration = {
    displayName: 'NewMember',
    agreements: { age: true, nudity: true, meet: true, cookies: true, terms: true },
  } as const;

  it('requires the shown list — a registration can no longer omit what it agreed to', () => {
    expect(RegisterUserInputSchema.safeParse(registration).success).toBe(false);
    expect(
      RegisterUserInputSchema.safeParse({
        ...registration,
        publicDocuments: [
          { documentId: TERMS, version: 2 },
          { documentId: DMCA, version: 1 },
        ],
      }).success,
    ).toBe(true);
  });

  it('first-admin bootstrap: before any release the page shows nothing, and that matches', () => {
    const shown = changedPublicDocuments(undefined, undefined);
    expect(shown).toEqual([]);
    expect(RegisterUserInputSchema.safeParse({ ...registration, publicDocuments: shown }).success).toBe(true);
    expect(samePublicDocumentVersions(shown, changedPublicDocuments(undefined, undefined))).toBe(true);
  });

  it('takes the same list shape as the Accept input — each document once, published versions only', () => {
    expect(
      RegisterUserInputSchema.safeParse({
        ...registration,
        publicDocuments: [
          { documentId: TERMS, version: 2 },
          { documentId: TERMS, version: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      RegisterUserInputSchema.safeParse({ ...registration, publicDocuments: [{ documentId: TERMS, version: 0 }] }).success,
    ).toBe(false);
    expect(
      RegisterUserInputSchema.safeParse({ ...registration, publicDocuments: [{ documentId: 'cookiePolicy', version: 1 }] })
        .success,
    ).toBe(false);
    // The client never names a level.
    expect(
      RegisterUserInputSchema.safeParse({ ...registration, publicDocuments: [], acceptedLevel: 1 }).success,
    ).toBe(false);
  });

  it('a release racing the signup page is detected by the one comparison rule', () => {
    const first = planPublicDocumentRelease(undefined, [TERMS, RULES], true);
    const shown = changedPublicDocuments(first.block, undefined);
    expect(samePublicDocumentVersions(shown, changedPublicDocuments(first.block, undefined))).toBe(true);
    const raced = planPublicDocumentRelease(first.block, [TERMS], false);
    expect(samePublicDocumentVersions(shown, changedPublicDocuments(raced.block, undefined))).toBe(false);
  });

  it('answers registered or refreshRequired — the same refusal arm as Accept', () => {
    expect(RegisterUserResultSchema.safeParse({ status: 'registered' }).success).toBe(true);
    expect(RegisterUserResultSchema.safeParse({ status: 'refreshRequired' }).success).toBe(true);
    expect(AcceptPublicDocumentsResultSchema.safeParse({ status: 'refreshRequired' }).success).toBe(true);
    expect(RegisterUserResultSchema.safeParse({ success: true }).success).toBe(false);
    expect(RegisterUserResultSchema.safeParse({ status: 'accepted', acceptedLevel: 1 }).success).toBe(false);
  });

  it('both callables are importable from the one schemas subpath', () => {
    expect(schemasBarrel.RegisterUserInputSchema).toBe(RegisterUserInputSchema);
    expect(schemasBarrel.RegisterUserResultSchema).toBe(RegisterUserResultSchema);
    expect(schemasBarrel.ShownPublicDocumentVersionsSchema).toBe(AcceptPublicDocumentsInputSchema.shape.documents);
    expect(RegisterUserInputSchema.shape.publicDocuments).toBe(AcceptPublicDocumentsInputSchema.shape.documents);
  });
});

describe('audit payloads', () => {
  it('publicDocuments.released', () => {
    expect(
      PublicDocumentsReleasedAuditPayloadSchema.safeParse({
        releaseId: RELEASE_ID,
        documents: [{ documentId: TERMS, version: 2 }],
        requireAcceptance: false,
        requiredAcceptanceLevel: 1,
      }).success,
    ).toBe(true);
  });

  it('publicDocuments.accepted — the pairs shown, the level, the notice revision (or null), server time', () => {
    const payload = {
      acceptedVia: 'reacceptance',
      documents: [{ documentId: TERMS, version: 3 }],
      acceptedLevel: 2,
      legalReviewNoticeRevision: 'founder-note-v1',
      acceptedAt: 1,
    };
    expect(PublicDocumentsAcceptedAuditPayloadSchema.safeParse(payload).success).toBe(true);
    expect(
      PublicDocumentsAcceptedAuditPayloadSchema.safeParse({ ...payload, acceptedVia: 'registration', legalReviewNoticeRevision: null })
        .success,
    ).toBe(true);
    expect(PublicDocumentsAcceptedAuditPayloadSchema.safeParse({ ...payload, acceptedVia: 'popup' }).success).toBe(false);
  });

  it('social.squareStreetzAgreementsAccepted — the Rules version accepted and the one it replaced (or null)', () => {
    const payload = { acceptedVersion: 3, previousAcceptedVersion: 2 };
    expect(SquareStreetzAgreementsAcceptedAuditPayloadSchema.safeParse(payload).success).toBe(true);
    // The first acceptance replaces nothing; before any Rules release the version accepted is 0.
    expect(
      SquareStreetzAgreementsAcceptedAuditPayloadSchema.safeParse({ acceptedVersion: 0, previousAcceptedVersion: null }).success,
    ).toBe(true);
    // Both versions are the canonical version-or-none value, never a bare number.
    expect(SquareStreetzAgreementsAcceptedAuditPayloadSchema.shape.acceptedVersion).toBe(PublicDocumentVersionOrNoneSchema);
    for (const version of [-1, 1.5, '3', null]) {
      expect(SquareStreetzAgreementsAcceptedAuditPayloadSchema.safeParse({ ...payload, acceptedVersion: version }).success).toBe(false);
    }
    for (const version of [-1, 1.5, '2', undefined]) {
      expect(
        SquareStreetzAgreementsAcceptedAuditPayloadSchema.safeParse({ ...payload, previousAcceptedVersion: version }).success,
      ).toBe(false);
    }
    expect(SquareStreetzAgreementsAcceptedAuditPayloadSchema.safeParse({ ...payload, acceptedAt: 1 }).success).toBe(false);
  });

  it('the Square agreements payload is importable from the one schemas subpath', () => {
    expect(schemasBarrel.SquareStreetzAgreementsAcceptedAuditPayloadSchema).toBe(
      SquareStreetzAgreementsAcceptedAuditPayloadSchema,
    );
    expect(docSchemasBarrel.PublicDocumentVersionOrNoneSchema).toBe(PublicDocumentVersionOrNoneSchema);
  });
});

describe('founder-notice receipts on the pledge and Hall-submission paths', () => {
  const receipt = { revision: 'founder-note-v1', acknowledgedAt: 1 };

  it('the checkout and submit inputs carry the checkbox — true when ticked, omitted or null otherwise', () => {
    const checkout = { amount: 500, checkoutAttemptId: RELEASE_ID, ageAttested: true as const };
    expect(CreateStripeCheckoutSessionInputSchema.safeParse({ ...checkout, legalReviewNoticeAcknowledged: true }).success).toBe(true);
    expect(CreateStripeCheckoutSessionInputSchema.safeParse({ ...checkout, legalReviewNoticeAcknowledged: null }).success).toBe(true);
    expect(CreateStripeCheckoutSessionInputSchema.safeParse(checkout).success).toBe(true);
    expect(CreateStripeCheckoutSessionInputSchema.safeParse({ ...checkout, legalReviewNoticeAcknowledged: false }).success).toBe(false);

    const submit = { workProjectId: 'w1', workProjectType: 'Tales', selectedItemIds: ['c1'], depictsRealPeople: false };
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, legalReviewNoticeAcknowledged: true }).success).toBe(true);
    expect(SubmitForThresholdLibraryReviewInputSchema.safeParse({ ...submit, legalReviewNoticeAcknowledged: 'yes' }).success).toBe(false);
  });

  it('the provider-ref evidence and the threshold item hold the receipt', () => {
    expect(PledgePaymentProviderRefSchema.shape.legalReviewNotice.safeParse(receipt).success).toBe(true);
    expect(ThresholdItemSchema.shape.legalReviewNotice.safeParse(receipt).success).toBe(true);
    expect(ThresholdItemSchema.shape.legalReviewNotice.safeParse(undefined).success).toBe(true);
  });
});

describe('type surface', () => {
  it('PublicDocumentId is the canonical union', () => {
    expectTypeOf<PublicDocumentId>().toEqualTypeOf<
      'termsOfService' | 'privacyPolicy' | 'rulesAndAgreements' | 'futurePlans' | 'dmcaPolicy' | 'takeItDownPageCopy'
    >();
  });
});
