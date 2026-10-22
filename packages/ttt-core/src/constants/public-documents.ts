import { SPECIAL_DOCS } from '../paths/collections.js';

export const PUBLIC_DOCUMENT_IDS = [
  SPECIAL_DOCS.TERMS_PAGE,
  SPECIAL_DOCS.PRIVACY_PAGE,
  SPECIAL_DOCS.RULES_AND_AGREEMENTS,
  SPECIAL_DOCS.FUTURE_PLANS,
  SPECIAL_DOCS.DMCA_POLICY,
  SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY,
] as const;
export type PublicDocumentId = (typeof PUBLIC_DOCUMENT_IDS)[number];

export const PUBLIC_DOCUMENT_LABELS: Record<PublicDocumentId, string> = {
  [SPECIAL_DOCS.TERMS_PAGE]: 'Terms of Service',
  [SPECIAL_DOCS.PRIVACY_PAGE]: 'Privacy Policy',
  [SPECIAL_DOCS.RULES_AND_AGREEMENTS]: 'Rules & Agreements',
  [SPECIAL_DOCS.FUTURE_PLANS]: 'Future Plans',
  [SPECIAL_DOCS.DMCA_POLICY]: 'DMCA Policy',
  [SPECIAL_DOCS.TAKE_IT_DOWN_PAGE_COPY]: 'Take It Down',
};

export const PUBLIC_DOCUMENTS_ACCEPTED_CLAIM = 'docsAccepted';

export const REGISTERED_MEMBER_CLAIM = 'registeredMember';

export const PUBLIC_DOCUMENT_ACCEPTANCE_SOURCES = ['registration', 'reacceptance'] as const;
export type PublicDocumentAcceptanceSource = (typeof PUBLIC_DOCUMENT_ACCEPTANCE_SOURCES)[number];

export const PUBLIC_DOCUMENTS_REACCEPTANCE_STATEMENT =
  'By choosing Accept, you agree to the current versions of the documents listed above.';

export const PUBLIC_DOCUMENT_HISTORY_PAGE_LIMIT = 10;
