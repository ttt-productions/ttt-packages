// Versioned public documents — the Firestore contracts of the release system.
//
//   _appConfig/{documentId}                                   current projection (public; the
//                                                             existing page readers read it)
//   publicDocuments/{documentId}/publicDocumentVersions/v{n}  immutable published version
//   publicDocumentDrafts/{documentId}                         the private working copy
//   publicDocumentReleases/{releaseId}                        one release record per publish
//   _appConfig/app.publicDocumentVersions                     the version block every session
//                                                             already reads live
//   userProfiles/{uid}/privateData/{uid}.publicDocumentAcceptance
//                                                             what the person last accepted
//
// All are backend-written. Versions are whole numbers v1, v2, … per document, assigned by the
// one publish transaction; a correction is a new version, never an edit. "Require acceptance"
// is recorded on the release and in the version block — never as a second version number.
// Acceptance HISTORY lives only in the append-only `publicDocuments.accepted` audit events.

import { z } from 'zod';
import { SPECIAL_DOCS } from '../paths/collections.js';
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

/** A published version number: v1 is the first. */
export const PublicDocumentVersionNumberSchema = z.number().int().positive();

/** A version reference where 0 means "none yet" (never accepted / never required / no base). */
const versionOrNoneSchema = z.number().int().nonnegative();

/** An acceptance level: 0 = nothing required / nothing accepted; each requiring release adds 1. */
export const PublicDocumentAcceptanceLevelSchema = z.number().int().nonnegative();

/** A document paired with one of its published versions. */
export const PublicDocumentVersionRefSchema = z
  .object({
    documentId: PublicDocumentIdSchema,
    version: PublicDocumentVersionNumberSchema,
  })
  .strict();
export type PublicDocumentVersionRef = z.infer<typeof PublicDocumentVersionRefSchema>;

// ── Content ──────────────────────────────────────────────────────────────────
// A document's CONTENT is its current-projection shape minus `version` / `lastUpdated`, so the
// existing page readers, the working copy, and the immutable version all share one shape.

export const LegalPageContentSchema = LegalPageDocumentSchema.pick({ sections: true });
export const RulesAndAgreementsContentSchema = RulesAndAgreementsSchema.pick({ rules: true, agreements: true });
export const FuturePlansContentSchema = FuturePlansDocumentSchema.pick({ plans: true });
export const TakeItDownPageCopyContentSchema = TakeItDownPageCopySchema.pick({ strings: true });
export const DmcaPolicyContentSchema = DmcaPolicyDocumentSchema.pick({
  intro: true,
  contactBlocks: true,
  sections: true,
});

/** Each document's stored content schema. */
export const PUBLIC_DOCUMENT_CONTENT_SCHEMAS = {
  [SPECIAL_DOCS.TERMS_PAGE]: LegalPageContentSchema,
  [SPECIAL_DOCS.PRIVACY_PAGE]: LegalPageContentSchema,
  [SPECIAL_DOCS.RULES_AND_AGREEMENTS]: RulesAndAgreementsContentSchema,
  [SPECIAL_DOCS.FUTURE_PLANS]: FuturePlansContentSchema,
  [SPECIAL_DOCS.DMCA_POLICY]: DmcaPolicyContentSchema,
  [SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]: TakeItDownPageCopyContentSchema,
} as const satisfies Record<PublicDocumentId, z.ZodType>;

/** The content of document `D`. */
export type PublicDocumentContent<D extends PublicDocumentId = PublicDocumentId> = z.infer<
  (typeof PUBLIC_DOCUMENT_CONTENT_SCHEMAS)[D]
>;

/** Each document's current-projection schema (`_appConfig/{documentId}`). */
export const PUBLIC_DOCUMENT_PROJECTION_SCHEMAS = {
  [SPECIAL_DOCS.TERMS_PAGE]: LegalPageDocumentSchema,
  [SPECIAL_DOCS.PRIVACY_PAGE]: LegalPageDocumentSchema,
  [SPECIAL_DOCS.RULES_AND_AGREEMENTS]: RulesAndAgreementsSchema,
  [SPECIAL_DOCS.FUTURE_PLANS]: FuturePlansDocumentSchema,
  [SPECIAL_DOCS.DMCA_POLICY]: DmcaPolicyDocumentSchema,
  [SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]: TakeItDownPageCopySchema,
} as const satisfies Record<PublicDocumentId, z.ZodType>;

/**
 * The current projection the publish writes for document `D`: its content plus the version and
 * the publish time. Assignable to the page's existing document type.
 */
export type PublicDocumentProjection<D extends PublicDocumentId = PublicDocumentId> =
  PublicDocumentContent<D> & { version: number; lastUpdated: number };

// One discriminated branch per document, so a version or draft's `content` is typed by its
// `documentId`.
function perDocument<const S extends z.ZodRawShape>(shape: S) {
  const branch = <const D extends PublicDocumentId>(documentId: D) =>
    z.object({ documentId: z.literal(documentId), content: PUBLIC_DOCUMENT_CONTENT_SCHEMAS[documentId], ...shape });
  return z.discriminatedUnion('documentId', [
    branch(SPECIAL_DOCS.TERMS_PAGE),
    branch(SPECIAL_DOCS.PRIVACY_PAGE),
    branch(SPECIAL_DOCS.RULES_AND_AGREEMENTS),
    branch(SPECIAL_DOCS.FUTURE_PLANS),
    branch(SPECIAL_DOCS.DMCA_POLICY),
    branch(SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY),
  ]);
}

// ── Immutable version ────────────────────────────────────────────────────────

/**
 * `publicDocuments/{documentId}/publicDocumentVersions/v{version}` — one published version,
 * written once by the publish transaction and never edited: the full content, the version,
 * the release that published it, the publisher's uid, and the server time.
 */
export const PublicDocumentVersionSchema = perDocument({
  version: PublicDocumentVersionNumberSchema,
  releaseId: z.string().min(1),
  publishedBy: z.string().min(1),
  publishedAt: z.number(),
});
export type PublicDocumentVersion = z.infer<typeof PublicDocumentVersionSchema>;

// ── Working copy ─────────────────────────────────────────────────────────────

/**
 * `publicDocumentDrafts/{documentId}` — the one private working copy of a document, saved from
 * its Admin editor. `baseVersion` is the published version the edit started from (0 when the
 * document has never been published): the publish rejects a draft whose base is no longer the
 * current version, and one whose content equals the current version.
 */
export const PublicDocumentDraftSchema = perDocument({
  baseVersion: versionOrNoneSchema,
  savedBy: z.string().min(1),
  savedAt: z.number(),
});
export type PublicDocumentDraft = z.infer<typeof PublicDocumentDraftSchema>;

// ── Release record ───────────────────────────────────────────────────────────

/**
 * `publicDocumentReleases/{releaseId}` — one record per publish: which documents moved to
 * which versions, whether the release requires acceptance, the required-acceptance level in
 * force after it (raised by one only when it requires acceptance), and who published it when.
 */
export const PublicDocumentReleaseSchema = z.object({
  releaseId: z.string().min(1),
  documents: z.array(PublicDocumentVersionRefSchema).min(1),
  requireAcceptance: z.boolean(),
  requiredAcceptanceLevel: PublicDocumentAcceptanceLevelSchema,
  publishedBy: z.string().min(1),
  publishedAt: z.number(),
});
export type PublicDocumentRelease = z.infer<typeof PublicDocumentReleaseSchema>;

// ── Version block on _appConfig/app ──────────────────────────────────────────

/**
 * One document's entry in the version block: its current published version and the latest
 * version a release REQUIRED acceptance of (0 when none has).
 */
export const PublicDocumentVersionStateSchema = z
  .object({
    currentVersion: PublicDocumentVersionNumberSchema,
    requiredVersion: versionOrNoneSchema,
  })
  .strict()
  .refine((state) => state.requiredVersion <= state.currentVersion, {
    message: 'requiredVersion cannot exceed currentVersion',
  });
export type PublicDocumentVersionState = z.infer<typeof PublicDocumentVersionStateSchema>;

/**
 * `_appConfig/app.publicDocumentVersions` — written only by the publish transaction. A document
 * never published has no entry. `requiredAcceptanceLevel` rises by one with every release that
 * requires acceptance; a session whose accepted level is below it is asked to accept.
 */
export const PublicDocumentVersionBlockSchema = z
  .object({
    documents: z.partialRecord(PublicDocumentIdSchema, PublicDocumentVersionStateSchema),
    requiredAcceptanceLevel: PublicDocumentAcceptanceLevelSchema,
  })
  .strict();
export type PublicDocumentVersionBlock = z.infer<typeof PublicDocumentVersionBlockSchema>;

// ── The person's acceptance summary (private doc) ────────────────────────────

/**
 * `privateData/{uid}.publicDocumentAcceptance` — the LATEST accepted version of each document
 * and the accepted level, replaced whole on every acceptance (registration or the re-acceptance
 * prompt). A document absent from `documentVersions` counts as version 0. The notice revision in
 * force at that acceptance is recorded when the notice was active. History is not kept here — it
 * is the `publicDocuments.accepted` audit events.
 */
export const PublicDocumentAcceptanceSchema = z
  .object({
    documentVersions: z.partialRecord(PublicDocumentIdSchema, versionOrNoneSchema),
    acceptedLevel: PublicDocumentAcceptanceLevelSchema,
    legalReviewNoticeRevision: LegalReviewNoticeRevisionSchema.optional(),
    acceptedAt: z.number(),
  })
  .strict();
export type PublicDocumentAcceptance = z.infer<typeof PublicDocumentAcceptanceSchema>;
