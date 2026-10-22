import { PUBLIC_DOCUMENT_IDS, type PublicDocumentId } from '../constants/public-documents.js';
import { SPECIAL_DOCS } from '../paths/collections.js';
import type {
  PublicDocumentAcceptance,
  PublicDocumentContent,
  PublicDocumentProjection,
  PublicDocumentVersionBlock,
  PublicDocumentVersionRef,
  PublicDocumentVersionState,
} from '../doc-schemas/public-documents.js';
import type { UserPrivateData } from '../doc-schemas/user.js';
import type { PublicDocumentVersionBlockReading } from './app-config.js';

export const EMPTY_PUBLIC_DOCUMENT_VERSION_BLOCK: PublicDocumentVersionBlock = Object.freeze({
  documents: Object.freeze({}),
  requiredAcceptanceLevel: 0,
}) as PublicDocumentVersionBlock;

export function currentPublicDocumentVersion(
  block: PublicDocumentVersionBlock | undefined,
  documentId: PublicDocumentId,
): number {
  return block?.documents[documentId]?.currentVersion ?? 0;
}

export function requiredPublicDocumentVersion(
  block: PublicDocumentVersionBlock | undefined,
  documentId: PublicDocumentId,
): number {
  return block?.documents[documentId]?.requiredVersion ?? 0;
}

export function requiredPublicDocumentAcceptanceLevel(
  block: PublicDocumentVersionBlock | undefined,
): number {
  return block?.requiredAcceptanceLevel ?? 0;
}

export function requiredPublicDocumentAcceptanceLevelOfReading(
  reading: PublicDocumentVersionBlockReading,
): number | null {
  return reading.status === 'invalid' ? null : requiredPublicDocumentAcceptanceLevel(reading.block);
}

export function acceptedPublicDocumentAcceptanceLevel(
  acceptance: PublicDocumentAcceptance | undefined,
): number {
  return acceptance?.acceptedLevel ?? 0;
}

export function acceptedPublicDocumentVersion(
  acceptance: PublicDocumentAcceptance | undefined,
  documentId: PublicDocumentId,
): number {
  return acceptance?.documentVersions[documentId] ?? 0;
}

export function isPublicDocumentAcceptanceRequired(
  block: PublicDocumentVersionBlock | undefined,
  acceptance: PublicDocumentAcceptance | undefined,
): boolean {
  return (
    requiredPublicDocumentAcceptanceLevel(block) > acceptedPublicDocumentAcceptanceLevel(acceptance)
  );
}

export function changedPublicDocuments(
  block: PublicDocumentVersionBlock | undefined,
  acceptance: PublicDocumentAcceptance | undefined,
): PublicDocumentVersionRef[] {
  const changed: PublicDocumentVersionRef[] = [];
  for (const documentId of PUBLIC_DOCUMENT_IDS) {
    const version = currentPublicDocumentVersion(block, documentId);
    if (version > acceptedPublicDocumentVersion(acceptance, documentId))
      changed.push({ documentId, version });
  }
  return changed;
}

export type SquareStreetzAgreementsRecord = Pick<
  UserPrivateData,
  'squareStreetzAgreementsDate' | 'squareStreetzAgreementsVersion'
>;

export function squareStreetzAgreementsSatisfied(
  privateData: SquareStreetzAgreementsRecord | null | undefined,
  block: PublicDocumentVersionBlock | undefined,
): boolean {
  const acceptedAt = privateData?.squareStreetzAgreementsDate;
  const acceptedRulesVersion = privateData?.squareStreetzAgreementsVersion;
  return (
    typeof acceptedAt === 'number' &&
    typeof acceptedRulesVersion === 'number' &&
    acceptedRulesVersion >= requiredPublicDocumentVersion(block, SPECIAL_DOCS.RULES_AND_AGREEMENTS)
  );
}

export function samePublicDocumentVersions(
  a: readonly PublicDocumentVersionRef[],
  b: readonly PublicDocumentVersionRef[],
): boolean {
  if (a.length !== b.length) return false;
  const key = (ref: PublicDocumentVersionRef) => `${ref.documentId}@${ref.version}`;
  const left = new Set(a.map(key));
  if (left.size !== a.length) return false;
  return b.every((ref) => left.has(key(ref)));
}

export function publicDocumentAcceptanceSummary(
  block: PublicDocumentVersionBlock | undefined,
  recorded: { acceptedAt: number; legalReviewNoticeRevision: string | null },
): PublicDocumentAcceptance {
  const documentVersions: PublicDocumentAcceptance['documentVersions'] = {};
  for (const documentId of PUBLIC_DOCUMENT_IDS) {
    const version = currentPublicDocumentVersion(block, documentId);
    if (version > 0) documentVersions[documentId] = version;
  }
  return {
    documentVersions,
    acceptedLevel: requiredPublicDocumentAcceptanceLevel(block),
    ...(recorded.legalReviewNoticeRevision !== null
      ? { legalReviewNoticeRevision: recorded.legalReviewNoticeRevision }
      : {}),
    acceptedAt: recorded.acceptedAt,
  };
}

export interface PublicDocumentReleasePlan {
  block: PublicDocumentVersionBlock;
  documents: PublicDocumentVersionRef[];
  requiredAcceptanceLevel: number;
}

export function planPublicDocumentRelease(
  block: PublicDocumentVersionBlock | undefined,
  documentIds: readonly PublicDocumentId[],
  requireAcceptance: boolean,
): PublicDocumentReleasePlan {
  if (documentIds.length === 0) throw new Error('A release must include at least one document.');
  const included = new Set(documentIds);
  if (included.size !== documentIds.length) throw new Error('A release lists each document once.');

  const previousLevel = requiredPublicDocumentAcceptanceLevel(block);
  const nextLevel = requireAcceptance ? previousLevel + 1 : previousLevel;
  const nextDocuments: Partial<Record<PublicDocumentId, PublicDocumentVersionState>> = {
    ...(block?.documents ?? {}),
  };
  const released: PublicDocumentVersionRef[] = [];

  for (const documentId of PUBLIC_DOCUMENT_IDS) {
    if (!included.has(documentId)) continue;
    const previous = block?.documents[documentId];
    const version = (previous?.currentVersion ?? 0) + 1;
    nextDocuments[documentId] = {
      currentVersion: version,
      requiredVersion: requireAcceptance ? version : (previous?.requiredVersion ?? 0),
    };
    released.push({ documentId, version });
  }

  return {
    block: { documents: nextDocuments, requiredAcceptanceLevel: nextLevel },
    documents: released,
    requiredAcceptanceLevel: nextLevel,
  };
}

export function buildPublicDocumentProjection<D extends PublicDocumentId>(
  content: PublicDocumentContent<D>,
  version: number,
  publishedAt: number,
): PublicDocumentProjection<D> {
  return { ...content, version, lastUpdated: publishedAt };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function publicDocumentContentEquals<D extends PublicDocumentId>(
  a: PublicDocumentContent<D>,
  b: PublicDocumentContent<D>,
): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
