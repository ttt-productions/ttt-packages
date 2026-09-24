// Pure rules of the versioned public-document system — the version math the one publish
// transaction applies, and the comparisons both the acceptance prompt (client) and the
// acceptance callable (server) make. One owner, so the prompt and the server can never
// disagree about what changed or what is required.

import { PUBLIC_DOCUMENT_IDS, type PublicDocumentId } from '../constants/public-documents.js';
import type {
  PublicDocumentAcceptance,
  PublicDocumentContent,
  PublicDocumentProjection,
  PublicDocumentVersionBlock,
  PublicDocumentVersionRef,
  PublicDocumentVersionState,
} from '../doc-schemas/public-documents.js';

/** The version block before any release: every document at version 0, nothing required. */
export const EMPTY_PUBLIC_DOCUMENT_VERSION_BLOCK: PublicDocumentVersionBlock = Object.freeze({
  documents: Object.freeze({}),
  requiredAcceptanceLevel: 0,
}) as PublicDocumentVersionBlock;

/** A document's current published version; 0 when it has never been published. */
export function currentPublicDocumentVersion(
  block: PublicDocumentVersionBlock | undefined,
  documentId: PublicDocumentId,
): number {
  return block?.documents[documentId]?.currentVersion ?? 0;
}

/** The required-acceptance level in force; 0 when nothing has ever required acceptance. */
export function requiredPublicDocumentAcceptanceLevel(block: PublicDocumentVersionBlock | undefined): number {
  return block?.requiredAcceptanceLevel ?? 0;
}

/** The level a person has accepted; 0 when they have accepted nothing. */
export function acceptedPublicDocumentAcceptanceLevel(acceptance: PublicDocumentAcceptance | undefined): number {
  return acceptance?.acceptedLevel ?? 0;
}

/** A document's accepted version; 0 when the person never accepted it. */
export function acceptedPublicDocumentVersion(
  acceptance: PublicDocumentAcceptance | undefined,
  documentId: PublicDocumentId,
): number {
  return acceptance?.documentVersions[documentId] ?? 0;
}

/** True when the person must accept before continuing: the required level is above theirs. */
export function isPublicDocumentAcceptanceRequired(
  block: PublicDocumentVersionBlock | undefined,
  acceptance: PublicDocumentAcceptance | undefined,
): boolean {
  return requiredPublicDocumentAcceptanceLevel(block) > acceptedPublicDocumentAcceptanceLevel(acceptance);
}

/**
 * Every document whose CURRENT version is newer than the one the person accepted — including
 * changes from releases that did not require acceptance — at its current version, in canonical
 * order. This is exactly the list the acceptance prompt shows and the acceptance callable
 * expects back.
 */
export function changedPublicDocuments(
  block: PublicDocumentVersionBlock | undefined,
  acceptance: PublicDocumentAcceptance | undefined,
): PublicDocumentVersionRef[] {
  const changed: PublicDocumentVersionRef[] = [];
  for (const documentId of PUBLIC_DOCUMENT_IDS) {
    const version = currentPublicDocumentVersion(block, documentId);
    if (version > acceptedPublicDocumentVersion(acceptance, documentId)) changed.push({ documentId, version });
  }
  return changed;
}

/**
 * True when two document/version lists name the same pairs (order-insensitive). The acceptance
 * callable compares the versions the prompt showed with `changedPublicDocuments` now; any
 * difference means a publish raced the prompt, so it refreshes and asks again.
 */
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

/**
 * The summary a person holds after accepting everything current — every published document at
 * its current version and the current required level. Registration and the acceptance callable
 * both write exactly this. `legalReviewNoticeRevision` is the active notice revision, or null
 * while the notice is off (then it is not recorded).
 */
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

/** What one release does to the version block. */
export interface PublicDocumentReleasePlan {
  /** The version block to write. */
  block: PublicDocumentVersionBlock;
  /** Each released document at its newly assigned version, in canonical order. */
  documents: PublicDocumentVersionRef[];
  /** The required-acceptance level after this release. */
  requiredAcceptanceLevel: number;
}

/**
 * Plan a release: each included document moves to its next whole-number version; when the
 * release requires acceptance, each also becomes that document's required version and the
 * required level rises by exactly one. Documents not in the release are untouched. Pure — the
 * publish transaction reads the block, plans, then writes the versions, projections, block,
 * release record, and audit event together. Throws on an empty or duplicated document list.
 */
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

/** The current projection the publish writes for a document: its content, version, and time. */
export function buildPublicDocumentProjection<D extends PublicDocumentId>(
  content: PublicDocumentContent<D>,
  version: number,
  publishedAt: number,
): PublicDocumentProjection<D> {
  return { ...content, version, lastUpdated: publishedAt };
}

// Key-order-insensitive canonical form of JSON-like content (strings, numbers, booleans,
// null, arrays, plain objects). An `undefined` object field is the same as an absent one.
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

/**
 * True when two contents of the same document are the same words and structure (field order
 * ignored). The publish rejects a working copy equal to the current version, and the Admin
 * release form keeps Publish disabled for one.
 */
export function publicDocumentContentEquals<D extends PublicDocumentId>(
  a: PublicDocumentContent<D>,
  b: PublicDocumentContent<D>,
): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
