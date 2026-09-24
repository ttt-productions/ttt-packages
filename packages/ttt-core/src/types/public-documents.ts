// Versioned public documents + the founder-notice receipt — document shapes (Zod schemas in
// ../doc-schemas/public-documents.ts and ../doc-schemas/legal-review-notice.ts; types inferred
// there). The ids, labels, and claim name live in ../constants/public-documents.ts.
export type {
  PublicDocumentVersionRef,
  PublicDocumentContent,
  PublicDocumentProjection,
  PublicDocumentVersion,
  PublicDocumentDraft,
  PublicDocumentRelease,
  PublicDocumentVersionState,
  PublicDocumentVersionBlock,
  PublicDocumentAcceptance,
} from '../doc-schemas/public-documents.js';
export type { LegalReviewNoticeReceipt } from '../doc-schemas/legal-review-notice.js';
