// ============================================================================
// PUBLIC DOCUMENTS — the Admin-editable public web pages that are versioned and
// published in release bundles: Terms of Service, Privacy Policy, Rules &
// Agreements, Future Plans, the DMCA policy, and the Take It Down explanatory
// copy. ONE owner for the document identity, display labels, and the numbers the
// release / acceptance flow uses.
//
// Each PublicDocumentId is ALSO the doc id of that document's public current
// projection under `_appConfig` (PATH_BUILDERS.publicDocumentProjection), so the
// ids derive from SPECIAL_DOCS rather than being restated.
//
// Versions are whole numbers v1, v2, … per document. "Require acceptance" is a
// property of a RELEASE, never a second version number: a release that requires
// acceptance raises the single required-acceptance level by one.
// ============================================================================

import { SPECIAL_DOCS } from '../paths/collections.js';

/** Every public document, in canonical display order. */
export const PUBLIC_DOCUMENT_IDS = [
  SPECIAL_DOCS.TERMS_PAGE,
  SPECIAL_DOCS.PRIVACY_PAGE,
  SPECIAL_DOCS.RULES_AND_AGREEMENTS,
  SPECIAL_DOCS.FUTURE_PLANS,
  SPECIAL_DOCS.DMCA_POLICY,
  SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY,
] as const;
export type PublicDocumentId = (typeof PUBLIC_DOCUMENT_IDS)[number];

/** The user-facing name of each public document (Admin list, acceptance prompt, links). */
export const PUBLIC_DOCUMENT_LABELS: Record<PublicDocumentId, string> = {
  [SPECIAL_DOCS.TERMS_PAGE]: 'Terms of Service',
  [SPECIAL_DOCS.PRIVACY_PAGE]: 'Privacy Policy',
  [SPECIAL_DOCS.RULES_AND_AGREEMENTS]: 'Rules & Agreements',
  [SPECIAL_DOCS.FUTURE_PLANS]: 'Future Plans',
  [SPECIAL_DOCS.DMCA_POLICY]: 'DMCA Policy',
  [SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]: 'Take It Down',
};

/**
 * The custom claim holding the caller's accepted level. Written by the acceptance core
 * (through `updateClaim`) and read by the backend acceptance gate (auth-core's
 * `acceptance.claimKey`) — one name for both sides.
 */
export const PUBLIC_DOCUMENTS_ACCEPTED_CLAIM = 'docsAccepted';

/**
 * How an acceptance was recorded: at registration, or through the re-acceptance prompt.
 * Both write the same private summary and the same `publicDocuments.accepted` audit event.
 */
export const PUBLIC_DOCUMENT_ACCEPTANCE_SOURCES = ['registration', 'reacceptance'] as const;
export type PublicDocumentAcceptanceSource = (typeof PUBLIC_DOCUMENT_ACCEPTANCE_SOURCES)[number];

/** Versions returned per page by the Admin history read (newest first). */
export const PUBLIC_DOCUMENT_HISTORY_PAGE_LIMIT = 10;
