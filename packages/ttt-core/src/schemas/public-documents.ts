// Callable wire contracts of the versioned public-document system, plus the payloads of its two
// audit events. The Firestore document shapes live in ../doc-schemas/public-documents.ts.
//
// The client never supplies an authoritative version, identity, or time: a working copy names
// only the version its edit STARTED from; the publish assigns versions; the acceptance names
// only the versions it SHOWED, which the server compares with what is current now.

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

/** A document/version list that names each document at most once. */
const distinctVersionRefs = (refs: readonly PublicDocumentVersionRef[]) =>
  new Set(refs.map((ref) => ref.documentId)).size === refs.length;

// ── Save a working copy ──────────────────────────────────────────────────────

/**
 * `savePublicDocumentDraft` — replace a document's one private working copy with the editor's
 * FULL content. `baseVersion` is the published version the edit started from (the prior version
 * the editor showed for reference; 0 for a never-published document). The server refuses a base
 * that is no longer current. Discriminated on `documentId`, so each document's content is
 * validated by its own schema.
 */
export const SavePublicDocumentDraftInputSchema = z.discriminatedUnion('documentId', [
  z.object({
    documentId: z.literal(SPECIAL_DOCS.TERMS_PAGE),
    baseVersion: baseVersionSchema,
    content: LegalPageContentInputSchema,
  }).strict(),
  z.object({
    documentId: z.literal(SPECIAL_DOCS.PRIVACY_PAGE),
    baseVersion: baseVersionSchema,
    content: LegalPageContentInputSchema,
  }).strict(),
  z.object({
    documentId: z.literal(SPECIAL_DOCS.RULES_AND_AGREEMENTS),
    baseVersion: baseVersionSchema,
    content: RulesAndAgreementsContentInputSchema,
  }).strict(),
  z.object({
    documentId: z.literal(SPECIAL_DOCS.FUTURE_PLANS),
    baseVersion: baseVersionSchema,
    content: FuturePlansContentInputSchema,
  }).strict(),
  z.object({
    documentId: z.literal(SPECIAL_DOCS.DMCA_POLICY),
    baseVersion: baseVersionSchema,
    content: DmcaPolicyContentInputSchema,
  }).strict(),
  z.object({
    documentId: z.literal(SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY),
    baseVersion: baseVersionSchema,
    content: TakeItDownPageCopyContentInputSchema,
  }).strict(),
]);
export type SavePublicDocumentDraftInput = z.infer<typeof SavePublicDocumentDraftInputSchema>;

export const SavePublicDocumentDraftResultSchema = z.object({
  documentId: PublicDocumentIdSchema,
  baseVersion: baseVersionSchema,
  savedAt: z.number(),
});
export type SavePublicDocumentDraftResult = z.infer<typeof SavePublicDocumentDraftResultSchema>;

// ── Publish a release ────────────────────────────────────────────────────────

/**
 * `publishPublicDocumentRelease` — publish the saved working copies of the listed documents as
 * ONE all-or-nothing release. `releaseId` is minted by the client once per release attempt and
 * reused on retry, so a repeated call finds the release it already committed instead of
 * publishing twice. `requireAcceptance` is the release's one choice (the form defaults it to yes).
 * Every listed document must have a saved working copy whose base is still current and whose
 * content differs from the current version.
 */
export const PublishPublicDocumentReleaseInputSchema = z.object({
  releaseId: z.string().uuid(),
  documentIds: z
    .array(PublicDocumentIdSchema)
    .min(1)
    .max(PUBLIC_DOCUMENT_IDS.length)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'List each document once.' }),
  requireAcceptance: z.boolean(),
}).strict();
export type PublishPublicDocumentReleaseInput = z.infer<typeof PublishPublicDocumentReleaseInputSchema>;

export const PublishPublicDocumentReleaseResultSchema = z.object({
  releaseId: z.string().min(1),
  documents: z.array(PublicDocumentVersionRefSchema).min(1),
  requireAcceptance: z.boolean(),
  requiredAcceptanceLevel: PublicDocumentAcceptanceLevelSchema,
});
export type PublishPublicDocumentReleaseResult = z.infer<typeof PublishPublicDocumentReleaseResultSchema>;

// ── Accept ───────────────────────────────────────────────────────────────────

/**
 * `acceptPublicDocuments` — the acceptance prompt's Accept. `documents` is exactly the list the
 * prompt SHOWED (`changedPublicDocuments` for this person, at the versions shown). The server
 * accepts only when that equals what is current now; otherwise it answers `refreshRequired` and
 * the prompt asks again. Idempotent.
 */
export const AcceptPublicDocumentsInputSchema = z.object({
  documents: z
    .array(PublicDocumentVersionRefSchema)
    .max(PUBLIC_DOCUMENT_IDS.length)
    .refine(distinctVersionRefs, { message: 'List each document once.' }),
}).strict();
export type AcceptPublicDocumentsInput = z.infer<typeof AcceptPublicDocumentsInputSchema>;

export const AcceptPublicDocumentsResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('accepted'),
    /** The level now on the private summary and the `docsAccepted` claim (refresh the token). */
    acceptedLevel: PublicDocumentAcceptanceLevelSchema,
  }),
  z.object({
    /** A publish raced the prompt: what it showed is no longer current. Nothing was written. */
    status: z.literal('refreshRequired'),
  }),
]);
export type AcceptPublicDocumentsResult = z.infer<typeof AcceptPublicDocumentsResultSchema>;

// ── History ──────────────────────────────────────────────────────────────────

/**
 * `readPublicDocumentHistory` — Admin's read-only history of one document, newest first, a page
 * of PUBLIC_DOCUMENT_HISTORY_PAGE_LIMIT at a time. `beforeVersion` continues from the previous
 * page's `nextBeforeVersion`.
 */
export const ReadPublicDocumentHistoryInputSchema = z.object({
  documentId: PublicDocumentIdSchema,
  beforeVersion: PublicDocumentVersionNumberSchema.nullish(),
}).strict();
export type ReadPublicDocumentHistoryInput = z.infer<typeof ReadPublicDocumentHistoryInputSchema>;

export const ReadPublicDocumentHistoryResultSchema = z.object({
  /** Full immutable versions — content, version, release, publisher uid, and time. */
  versions: z.array(PublicDocumentVersionSchema),
  /** Pass as `beforeVersion` for the next page; null when this page reached v1. */
  nextBeforeVersion: PublicDocumentVersionNumberSchema.nullable(),
});
export type ReadPublicDocumentHistoryResult = z.infer<typeof ReadPublicDocumentHistoryResultSchema>;

// ── Audit payloads ───────────────────────────────────────────────────────────
// The `metadata` of the two audit events. The actor, target, and server timestamp ride the
// event envelope; these carry what the release or acceptance was.

/** `publicDocuments.released` — written in the publish transaction (adminReview actor). */
export const PublicDocumentsReleasedAuditPayloadSchema = z.object({
  releaseId: z.string().min(1),
  documents: z.array(PublicDocumentVersionRefSchema).min(1),
  requireAcceptance: z.boolean(),
  requiredAcceptanceLevel: PublicDocumentAcceptanceLevelSchema,
}).strict();
export type PublicDocumentsReleasedAuditPayload = z.infer<typeof PublicDocumentsReleasedAuditPayloadSchema>;

/**
 * `publicDocuments.accepted` — written in the same commit as the private summary, by the
 * acceptance callable (the pairs the prompt showed) and by registration (every current document).
 * `legalReviewNoticeRevision` is null when the notice was off. `acceptedAt` is server time.
 */
export const PublicDocumentsAcceptedAuditPayloadSchema = z.object({
  acceptedVia: z.enum(PUBLIC_DOCUMENT_ACCEPTANCE_SOURCES),
  documents: z.array(PublicDocumentVersionRefSchema),
  acceptedLevel: PublicDocumentAcceptanceLevelSchema,
  legalReviewNoticeRevision: LegalReviewNoticeRevisionSchema.nullable(),
  acceptedAt: z.number(),
}).strict();
export type PublicDocumentsAcceptedAuditPayload = z.infer<typeof PublicDocumentsAcceptedAuditPayloadSchema>;
