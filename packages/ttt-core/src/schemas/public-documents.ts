import { z } from 'zod';
import { SPECIAL_DOCS } from '../paths/collections.js';
import {
  PUBLIC_DOCUMENT_IDS,
  PUBLIC_DOCUMENT_ACCEPTANCE_SOURCES,
} from '../constants/public-documents.js';
import {
  PublicDocumentIdSchema,
  PublicDocumentVersionNumberSchema,
  PublicDocumentAcceptanceLevelSchema,
  PublicDocumentVersionRefSchema,
  PublicDocumentVersionSchema,
  PublicDocumentDraftRevisionSchema,
  PublicDocumentDraftRevisionOrNoneSchema,
  type PublicDocumentVersionRef,
} from '../doc-schemas/public-documents.js';
import { LegalReviewNoticeRevisionSchema } from '../doc-schemas/legal-review-notice.js';
import {
  LegalPageContentInputSchema,
  RulesAndAgreementsContentInputSchema,
  FuturePlansContentInputSchema,
  DmcaPolicyContentInputSchema,
  TakeItDownPageCopyContentInputSchema,
} from './admin.js';

const baseVersionSchema = z.number().int().nonnegative();

const distinctVersionRefs = (refs: readonly PublicDocumentVersionRef[]) =>
  new Set(refs.map((ref) => ref.documentId)).size === refs.length;

export const ShownPublicDocumentVersionsSchema = z
  .array(PublicDocumentVersionRefSchema)
  .max(PUBLIC_DOCUMENT_IDS.length)
  .refine(distinctVersionRefs, { message: 'List each document once.' });

export const PublicDocumentsRefreshRequiredResultSchema = z.object({
  status: z.literal('refreshRequired'),
});

export const SavePublicDocumentDraftInputSchema = z.discriminatedUnion('documentId', [
  z
    .object({
      documentId: z.literal(SPECIAL_DOCS.TERMS_PAGE),
      baseVersion: baseVersionSchema,
      expectedRevision: PublicDocumentDraftRevisionOrNoneSchema,
      content: LegalPageContentInputSchema,
    })
    .strict(),
  z
    .object({
      documentId: z.literal(SPECIAL_DOCS.PRIVACY_PAGE),
      baseVersion: baseVersionSchema,
      expectedRevision: PublicDocumentDraftRevisionOrNoneSchema,
      content: LegalPageContentInputSchema,
    })
    .strict(),
  z
    .object({
      documentId: z.literal(SPECIAL_DOCS.RULES_AND_AGREEMENTS),
      baseVersion: baseVersionSchema,
      expectedRevision: PublicDocumentDraftRevisionOrNoneSchema,
      content: RulesAndAgreementsContentInputSchema,
    })
    .strict(),
  z
    .object({
      documentId: z.literal(SPECIAL_DOCS.FUTURE_PLANS),
      baseVersion: baseVersionSchema,
      expectedRevision: PublicDocumentDraftRevisionOrNoneSchema,
      content: FuturePlansContentInputSchema,
    })
    .strict(),
  z
    .object({
      documentId: z.literal(SPECIAL_DOCS.DMCA_POLICY),
      baseVersion: baseVersionSchema,
      expectedRevision: PublicDocumentDraftRevisionOrNoneSchema,
      content: DmcaPolicyContentInputSchema,
    })
    .strict(),
  z
    .object({
      documentId: z.literal(SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY),
      baseVersion: baseVersionSchema,
      expectedRevision: PublicDocumentDraftRevisionOrNoneSchema,
      content: TakeItDownPageCopyContentInputSchema,
    })
    .strict(),
]);
export type SavePublicDocumentDraftInput = z.infer<typeof SavePublicDocumentDraftInputSchema>;

export const SavePublicDocumentDraftResultSchema = z.object({
  documentId: PublicDocumentIdSchema,
  baseVersion: baseVersionSchema,
  revision: PublicDocumentDraftRevisionSchema,
  savedAt: z.number(),
});
export type SavePublicDocumentDraftResult = z.infer<typeof SavePublicDocumentDraftResultSchema>;

export const PublicDocumentDraftRevisionRefSchema = z
  .object({
    documentId: PublicDocumentIdSchema,
    expectedRevision: PublicDocumentDraftRevisionSchema,
  })
  .strict();
export type PublicDocumentDraftRevisionRef = z.infer<typeof PublicDocumentDraftRevisionRefSchema>;

export const PublishPublicDocumentReleaseInputSchema = z
  .object({
    releaseId: z.string().uuid(),
    drafts: z
      .array(PublicDocumentDraftRevisionRefSchema)
      .min(1)
      .max(PUBLIC_DOCUMENT_IDS.length)
      .refine((drafts) => new Set(drafts.map((draft) => draft.documentId)).size === drafts.length, {
        message: 'List each document once.',
      }),
    requireAcceptance: z.boolean(),
  })
  .strict();
export type PublishPublicDocumentReleaseInput = z.infer<
  typeof PublishPublicDocumentReleaseInputSchema
>;

export const PublishPublicDocumentReleaseResultSchema = z.object({
  releaseId: z.string().min(1),
  documents: z.array(PublicDocumentVersionRefSchema).min(1),
  requireAcceptance: z.boolean(),
  requiredAcceptanceLevel: PublicDocumentAcceptanceLevelSchema,
});
export type PublishPublicDocumentReleaseResult = z.infer<
  typeof PublishPublicDocumentReleaseResultSchema
>;

export const AcceptPublicDocumentsInputSchema = z
  .object({
    documents: ShownPublicDocumentVersionsSchema,
  })
  .strict();
export type AcceptPublicDocumentsInput = z.infer<typeof AcceptPublicDocumentsInputSchema>;

export const AcceptPublicDocumentsResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('accepted'),
    acceptedLevel: PublicDocumentAcceptanceLevelSchema,
  }),
  PublicDocumentsRefreshRequiredResultSchema,
]);
export type AcceptPublicDocumentsResult = z.infer<typeof AcceptPublicDocumentsResultSchema>;

export const ReadPublicDocumentHistoryInputSchema = z
  .object({
    documentId: PublicDocumentIdSchema,
    beforeVersion: PublicDocumentVersionNumberSchema.nullish(),
  })
  .strict();
export type ReadPublicDocumentHistoryInput = z.infer<typeof ReadPublicDocumentHistoryInputSchema>;

export const ReadPublicDocumentHistoryResultSchema = z.object({
  versions: z.array(PublicDocumentVersionSchema),
  nextBeforeVersion: PublicDocumentVersionNumberSchema.nullable(),
});
export type ReadPublicDocumentHistoryResult = z.infer<typeof ReadPublicDocumentHistoryResultSchema>;

export const PublicDocumentsReleasedAuditPayloadSchema = z
  .object({
    releaseId: z.string().min(1),
    documents: z.array(PublicDocumentVersionRefSchema).min(1),
    requireAcceptance: z.boolean(),
    requiredAcceptanceLevel: PublicDocumentAcceptanceLevelSchema,
  })
  .strict();
export type PublicDocumentsReleasedAuditPayload = z.infer<
  typeof PublicDocumentsReleasedAuditPayloadSchema
>;

export const PublicDocumentsAcceptedAuditPayloadSchema = z
  .object({
    acceptedVia: z.enum(PUBLIC_DOCUMENT_ACCEPTANCE_SOURCES),
    documents: z.array(PublicDocumentVersionRefSchema),
    acceptedLevel: PublicDocumentAcceptanceLevelSchema,
    legalReviewNoticeRevision: LegalReviewNoticeRevisionSchema.nullable(),
    acceptedAt: z.number(),
  })
  .strict();
export type PublicDocumentsAcceptedAuditPayload = z.infer<
  typeof PublicDocumentsAcceptedAuditPayloadSchema
>;
