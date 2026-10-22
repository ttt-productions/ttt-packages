import { z } from 'zod';
import { SPECIAL_DOCS } from '../paths/collections.js';
import { PATH_BUILDERS } from '../paths/path-builders.js';
import { PUBLIC_DOCUMENT_IDS, type PublicDocumentId } from '../constants/public-documents.js';
import {
  LegalPageDocumentSchema,
  RulesAndAgreementsSchema,
  FuturePlansDocumentSchema,
  TakeItDownPageCopySchema,
  DmcaPolicyDocumentSchema,
} from './content.js';
import { LegalReviewNoticeRevisionSchema } from './legal-review-notice.js';

export const PublicDocumentIdSchema = z.enum(PUBLIC_DOCUMENT_IDS);

export const PublicDocumentVersionNumberSchema = z.number().int().positive();

export const PublicDocumentVersionOrNoneSchema = z.number().int().nonnegative();

export const PublicDocumentAcceptanceLevelSchema = z.number().int().nonnegative();

export const PublicDocumentVersionRefSchema = z
  .object({
    documentId: PublicDocumentIdSchema,
    version: PublicDocumentVersionNumberSchema,
  })
  .strict();
export type PublicDocumentVersionRef = z.infer<typeof PublicDocumentVersionRefSchema>;

export const LegalPageContentSchema = LegalPageDocumentSchema.pick({ sections: true });
export const RulesAndAgreementsContentSchema = RulesAndAgreementsSchema.pick({
  intro: true,
  groupIntentions: true,
  rules: true,
  agreements: true,
});
export const FuturePlansContentSchema = FuturePlansDocumentSchema.pick({
  intro: true,
  groups: true,
  plans: true,
});
export const TakeItDownPageCopyContentSchema = TakeItDownPageCopySchema.pick({ strings: true });
export const DmcaPolicyContentSchema = DmcaPolicyDocumentSchema.pick({
  intro: true,
  contactBlocks: true,
  sections: true,
});

export const PUBLIC_DOCUMENT_CONTENT_SCHEMAS = {
  [SPECIAL_DOCS.TERMS_PAGE]: LegalPageContentSchema,
  [SPECIAL_DOCS.PRIVACY_PAGE]: LegalPageContentSchema,
  [SPECIAL_DOCS.RULES_AND_AGREEMENTS]: RulesAndAgreementsContentSchema,
  [SPECIAL_DOCS.FUTURE_PLANS]: FuturePlansContentSchema,
  [SPECIAL_DOCS.DMCA_POLICY]: DmcaPolicyContentSchema,
  [SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]: TakeItDownPageCopyContentSchema,
} as const satisfies Record<PublicDocumentId, z.ZodType>;

export type PublicDocumentContent<D extends PublicDocumentId = PublicDocumentId> = z.infer<
  (typeof PUBLIC_DOCUMENT_CONTENT_SCHEMAS)[D]
>;

function projection<const D extends PublicDocumentId, const S extends z.ZodType>(
  documentId: D,
  schema: S,
) {
  return {
    path: (): [string, string] => PATH_BUILDERS.publicDocumentProjection(documentId),
    schema,
  };
}

export const PUBLIC_DOCUMENT_PROJECTIONS = {
  [SPECIAL_DOCS.TERMS_PAGE]: projection(SPECIAL_DOCS.TERMS_PAGE, LegalPageDocumentSchema),
  [SPECIAL_DOCS.PRIVACY_PAGE]: projection(SPECIAL_DOCS.PRIVACY_PAGE, LegalPageDocumentSchema),
  [SPECIAL_DOCS.RULES_AND_AGREEMENTS]: projection(
    SPECIAL_DOCS.RULES_AND_AGREEMENTS,
    RulesAndAgreementsSchema,
  ),
  [SPECIAL_DOCS.FUTURE_PLANS]: projection(SPECIAL_DOCS.FUTURE_PLANS, FuturePlansDocumentSchema),
  [SPECIAL_DOCS.DMCA_POLICY]: projection(SPECIAL_DOCS.DMCA_POLICY, DmcaPolicyDocumentSchema),
  [SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]: projection(
    SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY,
    TakeItDownPageCopySchema,
  ),
} as const satisfies {
  [D in PublicDocumentId]: { path: () => [string, string]; schema: z.ZodType };
};

export type PublicDocumentProjection<D extends PublicDocumentId = PublicDocumentId> =
  PublicDocumentContent<D> & { version: number; lastUpdated: number };

function perDocument<const S extends z.ZodRawShape>(shape: S) {
  const branch = <const D extends PublicDocumentId>(documentId: D) =>
    z.object({
      documentId: z.literal(documentId),
      content: PUBLIC_DOCUMENT_CONTENT_SCHEMAS[documentId],
      ...shape,
    });
  return z.discriminatedUnion('documentId', [
    branch(SPECIAL_DOCS.TERMS_PAGE),
    branch(SPECIAL_DOCS.PRIVACY_PAGE),
    branch(SPECIAL_DOCS.RULES_AND_AGREEMENTS),
    branch(SPECIAL_DOCS.FUTURE_PLANS),
    branch(SPECIAL_DOCS.DMCA_POLICY),
    branch(SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY),
  ]);
}

export const PublicDocumentVersionSchema = perDocument({
  version: PublicDocumentVersionNumberSchema,
  releaseId: z.string().min(1),
  publishedBy: z.string().min(1),
  publishedAt: z.number(),
});
export type PublicDocumentVersion = z.infer<typeof PublicDocumentVersionSchema>;

export const PublicDocumentDraftRevisionSchema = z.number().int().positive();

export const PublicDocumentDraftRevisionOrNoneSchema = z.number().int().nonnegative();

export const PublicDocumentDraftSchema = perDocument({
  baseVersion: PublicDocumentVersionOrNoneSchema,
  revision: PublicDocumentDraftRevisionSchema,
  savedBy: z.string().min(1),
  savedAt: z.number(),
});
export type PublicDocumentDraft = z.infer<typeof PublicDocumentDraftSchema>;

export const PublicDocumentReleaseSchema = z.object({
  releaseId: z.string().min(1),
  documents: z.array(PublicDocumentVersionRefSchema).min(1),
  requireAcceptance: z.boolean(),
  requiredAcceptanceLevel: PublicDocumentAcceptanceLevelSchema,
  publishedBy: z.string().min(1),
  publishedAt: z.number(),
});
export type PublicDocumentRelease = z.infer<typeof PublicDocumentReleaseSchema>;

export const PublicDocumentVersionStateSchema = z
  .object({
    currentVersion: PublicDocumentVersionNumberSchema,
    requiredVersion: PublicDocumentVersionOrNoneSchema,
  })
  .strict()
  .refine((state) => state.requiredVersion <= state.currentVersion, {
    message: 'requiredVersion cannot exceed currentVersion',
  });
export type PublicDocumentVersionState = z.infer<typeof PublicDocumentVersionStateSchema>;

export const PublicDocumentVersionBlockSchema = z
  .object({
    documents: z.partialRecord(PublicDocumentIdSchema, PublicDocumentVersionStateSchema),
    requiredAcceptanceLevel: PublicDocumentAcceptanceLevelSchema,
  })
  .strict();
export type PublicDocumentVersionBlock = z.infer<typeof PublicDocumentVersionBlockSchema>;

export const PublicDocumentAcceptanceSchema = z
  .object({
    documentVersions: z.partialRecord(PublicDocumentIdSchema, PublicDocumentVersionOrNoneSchema),
    acceptedLevel: PublicDocumentAcceptanceLevelSchema,
    legalReviewNoticeRevision: LegalReviewNoticeRevisionSchema.optional(),
    acceptedAt: z.number(),
  })
  .strict();
export type PublicDocumentAcceptance = z.infer<typeof PublicDocumentAcceptanceSchema>;
