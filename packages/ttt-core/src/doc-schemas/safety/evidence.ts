// Trust & Safety — the evidence cluster (Appendix A §A4, Finding-H5 / Finding-M2).
//
// Two collections:
//   - `safetyEvidenceManifests/{manifestId}` = SafetyEvidenceManifestV1 — an
//     IMMUTABLE, versioned manifest. Finding-H5: a manifest is NO LONGER
//     media-shaped — a `sourceKind` discriminator ('media'|'communication'|
//     'externalFact') selects WHICH sub-object is present. No manifest may carry
//     a null/placeholder media object.
//   - `safetyEvidenceJobs/{jobId}` = SafetyEvidenceJobV1 — the capture/verify/
//     disposition saga row (Finding-M2: `commandId` + terminal timestamps; the
//     `verified` status is disambiguated as a (phase, status) PAIR, never a bare
//     status) with two subcollections: …/items/{itemId} and
//     …/disposition/{locationId}.
//
// Every shape here is transcribed verbatim from docs/code_changes_needed/
// trust-and-safety/IMPLEMENTATION_PLAN.md Appendix A §A4 — no invented values, no
// placeholders.
//
// SHARED media lineage comes from ../media-assets.js (the single canonical lineage
// used by media, CSAM, and safety); it is NEVER redefined here.
//
// Collection note: this cluster introduces TWO NEW Firestore collections plus two
// subcollections under `safetyEvidenceJobs`. Wiring collections.ts /
// path-builders.ts / registry.ts is deferred to the app leg (the orchestrator binds
// the schemas + path builders there); the deterministic doc-id shapes are
// documented on each schema below.

import { z } from 'zod';
import { MediaOriginLineageV1Schema } from '../media-assets.js';

// ===========================================================================
// §A4 manifest / communication array caps — the ONE named declaration (ARCH-102).
// Every `.max(...)` bound below derives from these; the app's evidence-manifest
// writer imports the SAME constants for its `bound(...)` checks so the schema and the
// writer can never drift to two different numbers.
// ===========================================================================

/** MAX variants[] on a media manifest (§A4). */
export const MAX_MANIFEST_VARIANTS = 64;
/** MAX provenanceRefs[] (eventProvenance ids promoted into the case) on a manifest (§A4). */
export const MAX_MANIFEST_PROVENANCE_REFS = 64;
/** MAX ncmecReceiptRefs[] on a manifest (§A4). */
export const MAX_MANIFEST_NCMEC_RECEIPTS = 32;
/** MAX attachmentItemIds[] on a communication manifest (§A4). */
export const MAX_COMMUNICATION_ATTACHMENTS = 256;

// ===========================================================================
// §A4 — safetyEvidenceManifests/{manifestId} = SafetyEvidenceManifestV1
// (Finding-H5). IMMUTABLE, versioned. `sourceKind` selects the present sub-object.
// ===========================================================================

/** The source-kind discriminator (Finding-H5). Selects WHICH sub-object is present
 * on the manifest: `media` → original/variants/lineage/evidenceCopy;
 * `communication` → communication; `externalFact` → externalFact. */
export const SafetyEvidenceSourceKindSchema = z.enum([
  'media',
  'communication',
  'externalFact',
]);
export type SafetyEvidenceSourceKind = z.infer<typeof SafetyEvidenceSourceKindSchema>;

/** §A4 `original` — present ONLY when sourceKind='media'. The captured original
 * object descriptor (never a serving URL). */
export const SafetyEvidenceOriginalV1Schema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
  generation: z.string().min(1),
  contentType: z.string().min(1),
  filename: z.string().min(1).optional(),
  sizeBytes: z.number(),
  md5: z.string().min(1),
  sha256: z.string().min(1),
  capturedAt: z.number(),
}).strict();
export type SafetyEvidenceOriginalV1 = z.infer<typeof SafetyEvidenceOriginalV1Schema>;

/** §A4 `variants[]` — media only; MAX 64. */
export const SafetyEvidenceVariantV1Schema = z.object({
  variantKey: z.string().min(1),
  sha256: z.string().min(1),
  sizeBytes: z.number(),
}).strict();
export type SafetyEvidenceVariantV1 = z.infer<typeof SafetyEvidenceVariantV1Schema>;

/** §A4 `communication` — present ONLY when sourceKind='communication'.
 * `attachmentItemIds` MAX 256. */
export const SafetyEvidenceCommunicationV1Schema = z.object({
  channelId: z.string().min(1),
  messageSeqStart: z.number(),
  messageSeqEnd: z.number(),
  transcriptObjectRef: z.string().min(1),
  attachmentItemIds: z.array(z.string().min(1)).max(MAX_COMMUNICATION_ATTACHMENTS),
}).strict();
export type SafetyEvidenceCommunicationV1 = z.infer<typeof SafetyEvidenceCommunicationV1Schema>;

/** §A4 externalFact `factKind`. */
export const SafetyEvidenceExternalFactKindSchema = z.enum([
  'lawEnforcement',
  'thirdPartyReport',
  'operatorKnowledge',
  'other',
]);
export type SafetyEvidenceExternalFactKind = z.infer<typeof SafetyEvidenceExternalFactKindSchema>;

/** §A4 `externalFact` — present ONLY when sourceKind='externalFact'. */
export const SafetyEvidenceExternalFactV1Schema = z.object({
  factKind: SafetyEvidenceExternalFactKindSchema,
  narrativeRef: z.string().min(1),
  establishedActualKnowledgeAt: z.number().optional(),
  sourceContactRef: z.string().min(1).optional(),
}).strict();
export type SafetyEvidenceExternalFactV1 = z.infer<typeof SafetyEvidenceExternalFactV1Schema>;

/** §A4 `detector` — never the raw hash. */
export const SafetyEvidenceDetectorV1Schema = z.object({
  source: z.string().min(1),
  listId: z.string().min(1),
  sdkVersion: z.string().min(1),
  requestTraceId: z.string().min(1),
  matchResult: z.string().min(1),
}).strict();
export type SafetyEvidenceDetectorV1 = z.infer<typeof SafetyEvidenceDetectorV1Schema>;

/** §A4 `evidenceCopy` — media only; the verified evidence-vault copy descriptor. */
export const SafetyEvidenceCopyV1Schema = z.object({
  destinationBucket: z.string().min(1),
  destinationKey: z.string().min(1),
  keyVersion: z.string().min(1),
  verifyMethod: z.string().min(1),
  verifyResult: z.string().min(1),
}).strict();
export type SafetyEvidenceCopyV1 = z.infer<typeof SafetyEvidenceCopyV1Schema>;

/** §A4 `reporter` — restricted; segregated from ordinary admin views. */
export const SafetyEvidenceReporterV1Schema = z.object({
  reporterUidRef: z.string().min(1),
  narrativeRef: z.string().min(1),
}).strict();
export type SafetyEvidenceReporterV1 = z.infer<typeof SafetyEvidenceReporterV1Schema>;

/**
 * `safetyEvidenceManifests/{manifestId}` — IMMUTABLE, versioned
 * SafetyEvidenceManifestV1 (Finding-H5). Doc id is the deterministic `manifestId`.
 *
 * **Invariant (H5) — enforced by the superRefine below:** no manifest may require a
 * null/placeholder media object. The sub-objects are present ONLY for their matching
 * `sourceKind`:
 *   - sourceKind='media'         → `original` + `lineage` REQUIRED; `variants`/
 *                                  `evidenceCopy` allowed; `communication`/
 *                                  `externalFact` MUST be absent.
 *   - sourceKind='communication' → `communication` REQUIRED; `original`/`variants`/
 *                                  `lineage`/`evidenceCopy`/`externalFact` MUST be absent.
 *   - sourceKind='externalFact'  → `externalFact` REQUIRED; `original`/`variants`/
 *                                  `lineage`/`evidenceCopy`/`communication` MUST be absent.
 *
 * Lineage-keyed auto-action + dedup (incident-wide blocking by `rootIngestId`,
 * auto-ban of `originatingUploaderUid`) apply ONLY to sourceKind='media' — a
 * communication/externalFact manifest carries no lineage and is multi-subject via
 * the case `…/accounts` subcollection (`subjectAccountsRef`), never a synthesized
 * uploader.
 */
export const SafetyEvidenceManifestV1Schema = z.object({
  schemaVersion: z.literal(1),
  manifestId: z.string().min(1),
  caseId: z.string().min(1),
  createdAt: z.number(),
  sourceKind: SafetyEvidenceSourceKindSchema, // REQUIRED — selects the present sub-object
  original: SafetyEvidenceOriginalV1Schema.optional(), // present ONLY when sourceKind='media'
  variants: z.array(SafetyEvidenceVariantV1Schema).max(MAX_MANIFEST_VARIANTS).optional(), // media only
  lineage: MediaOriginLineageV1Schema.optional(), // present ONLY when sourceKind='media'
  communication: SafetyEvidenceCommunicationV1Schema.optional(), // present ONLY when sourceKind='communication'
  externalFact: SafetyEvidenceExternalFactV1Schema.optional(), // present ONLY when sourceKind='externalFact'
  // multi-subject lives in the case childSafetyCases/{caseId}/accounts subcollection
  // (no fake uploader on the manifest); this points at …/accounts:
  subjectAccountsRef: z.string().min(1),
  provenanceRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_PROVENANCE_REFS), // eventProvenance ids promoted into the case
  contentDocSnapshotRef: z.string().min(1).optional(),
  contentDocRevision: z.number().optional(),
  detector: SafetyEvidenceDetectorV1Schema.optional(), // never the raw hash
  evidenceCopy: SafetyEvidenceCopyV1Schema.optional(), // media only
  reporter: SafetyEvidenceReporterV1Schema.optional(), // restricted; segregated from ordinary admin views
  ncmecReceiptRefs: z.array(z.string().min(1)).max(MAX_MANIFEST_NCMEC_RECEIPTS),
}).strict().superRefine((val, ctx) => {
  // H5 invariant: the sourceKind→present-object set. `media` requires original +
  // lineage and forbids communication/externalFact; `communication` requires
  // communication and forbids all media-only fields + externalFact; `externalFact`
  // requires externalFact and forbids all media-only fields + communication.
  const present = (field: string) =>
    ctx.addIssue({ code: 'custom', path: [field], message: `${field} is only allowed when sourceKind matches` });
  const missing = (field: string) =>
    ctx.addIssue({ code: 'custom', path: [field], message: `${field} is required for this sourceKind` });

  if (val.sourceKind === 'media') {
    if (val.original === undefined) missing('original');
    if (val.lineage === undefined) missing('lineage');
    if (val.communication !== undefined) present('communication');
    if (val.externalFact !== undefined) present('externalFact');
  } else if (val.sourceKind === 'communication') {
    if (val.communication === undefined) missing('communication');
    if (val.original !== undefined) present('original');
    if (val.variants !== undefined) present('variants');
    if (val.lineage !== undefined) present('lineage');
    if (val.evidenceCopy !== undefined) present('evidenceCopy');
    if (val.externalFact !== undefined) present('externalFact');
  } else {
    // externalFact
    if (val.externalFact === undefined) missing('externalFact');
    if (val.original !== undefined) present('original');
    if (val.variants !== undefined) present('variants');
    if (val.lineage !== undefined) present('lineage');
    if (val.evidenceCopy !== undefined) present('evidenceCopy');
    if (val.communication !== undefined) present('communication');
  }
});
export type SafetyEvidenceManifestV1 = z.infer<typeof SafetyEvidenceManifestV1Schema>;

// ===========================================================================
// §A4 — safetyEvidenceJobs/{jobId} = SafetyEvidenceJobV1 (Finding-M2).
// `verified` is disambiguated as a (phase, status) PAIR, never a bare status.
// `commandId` is deterministic per (jobId, phase). One worker per phase drives:
//   capture worker      → (capture: pending → running → verified) | (capture: deadLetter)
//   verify worker       → (verify: pending → running → verified)
//   disposition worker  → (disposition: pending → running → disposed) | (disposition: deadLetter)
// (disposition runs only after preservationStatus=dispositionPending). Terminal
// timestamps: completedAt on (capture|verify, verified), disposedAt on
// (disposition, disposed), deadLetterAt on any deadLetter.
// ===========================================================================

/** §A4 job phase — one worker per phase. */
export const SafetyEvidenceJobPhaseSchema = z.enum([
  'capture',
  'verify',
  'disposition',
]);
export type SafetyEvidenceJobPhase = z.infer<typeof SafetyEvidenceJobPhaseSchema>;

/** §A4 job status — disambiguated by the (phase, status) pairing rules above; never
 * a bare status. */
export const SafetyEvidenceJobStatusSchema = z.enum([
  'pending',
  'running',
  'verified',
  'disposed',
  'deadLetter',
]);
export type SafetyEvidenceJobStatus = z.infer<typeof SafetyEvidenceJobStatusSchema>;

/** `safetyEvidenceJobs/{jobId}` — the capture/verify/disposition saga row
 * (Finding-M2). Doc id is the deterministic `jobId`. `commandId` is deterministic
 * per (jobId, phase) — idempotent + replayed by commandId. */
export const SafetyEvidenceJobV1Schema = z.object({
  schemaVersion: z.literal(1),
  jobId: z.string().min(1),
  caseId: z.string().min(1),
  phase: SafetyEvidenceJobPhaseSchema,
  commandId: z.string().min(1), // deterministic per (jobId, phase)
  status: SafetyEvidenceJobStatusSchema,
  attemptCount: z.number(),
  nextAttemptAt: z.number(),
  leaseOwner: z.string().min(1).optional(),
  leaseExpiresAt: z.number().optional(),
  lastErrorCode: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(), // (capture|verify, verified)
  disposedAt: z.number().optional(), // (disposition, disposed)
  deadLetterAt: z.number().optional(), // any deadLetter
}).strict();
export type SafetyEvidenceJobV1 = z.infer<typeof SafetyEvidenceJobV1Schema>;

// ===========================================================================
// §A4 subcollections under a job
// ===========================================================================

/** §A4 job-item role — the source object vs the destination (evidence-copy) object. */
export const SafetyEvidenceJobItemRoleSchema = z.enum(['source', 'destination']);
export type SafetyEvidenceJobItemRole = z.infer<typeof SafetyEvidenceJobItemRoleSchema>;

/** §A4 job-item verify result. */
export const SafetyEvidenceJobItemVerifyResultSchema = z.enum(['pending', 'ok', 'mismatch']);
export type SafetyEvidenceJobItemVerifyResult = z.infer<typeof SafetyEvidenceJobItemVerifyResultSchema>;

/** `safetyEvidenceJobs/{jobId}/items/{itemId}` — per-object source/destination row.
 * Doc id is the `itemId`. */
export const SafetyEvidenceJobItemV1Schema = z.object({
  role: SafetyEvidenceJobItemRoleSchema,
  bucket: z.string().min(1),
  key: z.string().min(1),
  generation: z.string().min(1).optional(),
  sizeBytes: z.number(),
  sha256: z.string().min(1),
  md5: z.string().min(1).optional(),
  verifyResult: SafetyEvidenceJobItemVerifyResultSchema,
}).strict();
export type SafetyEvidenceJobItemV1 = z.infer<typeof SafetyEvidenceJobItemV1Schema>;

/** §A4 disposition method (per evidence location). */
export const SafetyEvidenceDispositionMethodSchema = z.enum(['delete', 'cryptoErase']);
export type SafetyEvidenceDispositionMethod = z.infer<typeof SafetyEvidenceDispositionMethodSchema>;

/** §A4 disposition result (per evidence location). */
export const SafetyEvidenceDispositionResultSchema = z.enum(['gone', 'leftover']);
export type SafetyEvidenceDispositionResult = z.infer<typeof SafetyEvidenceDispositionResultSchema>;

/** `safetyEvidenceJobs/{jobId}/disposition/{locationId}` — per-evidence-location
 * deletion-verification record. Doc id is the `locationId`.
 *
 * [M-5] This IS the durable hard-deletion attestation body: the disposition worker runs only after
 * the case reaches `preservationStatus:'dispositionPending'` (every hold ref released + a reviewed
 * disposition job), and records `method` + `verifiedAt` + `result`. Because soft-delete is DISABLED
 * on the evidence bucket, `result:'gone'` attests a verified TRUE hard-deletion (there is no
 * soft-delete/lifecycle tombstone to model — no `softDeletedAt`/`hardDeleteTime`). `generation`
 * pins the exact object generation that was destroyed, so a later object re-created at the same
 * bucket/key (a new generation) is never falsely attested as this destruction. */
export const SafetyEvidenceDispositionV1Schema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
  // [M-5] the exact object generation this record attests destroyed — pins the attestation to a
  // single immutable object version so a same-key re-upload (new generation) is not covered by it.
  // Optional: an object with no generation concept (or a leftover with none read) omits it.
  generation: z.string().min(1).optional(),
  method: SafetyEvidenceDispositionMethodSchema,
  verifiedAt: z.number(),
  result: SafetyEvidenceDispositionResultSchema,
  leftoverDetail: z.string().min(1).optional(),
}).strict();
export type SafetyEvidenceDispositionV1 = z.infer<typeof SafetyEvidenceDispositionV1Schema>;
