import type {
  ServerCollectionRef,
  ServerDocRef,
  ServerTransaction,
} from '@ttt-productions/firebase-helpers/server';
import { SHORT_LINK_ID_MAX_ATTEMPTS, generateShortLinkId } from '../short-link-id.js';
import type { RandomBytes } from '../short-link-id.js';
import type { ShortLinkDocument } from '../short-link-schema.js';

export interface ShortLinkCreateRequest<Type, Metadata> {
  links: ServerCollectionRef;
  destinationUrl: string;
  type: Type;
  metadata: Metadata;
  createdBy: string;
  now: number;
  randomBytes?: RandomBytes;
}

export interface ShortLinkCreateResult {
  shortId: string;
  created: boolean;
}

export class ShortLinkIdExhaustedError extends Error {
  constructor() {
    super(`No unused short link id was found in ${SHORT_LINK_ID_MAX_ATTEMPTS} attempts.`);
    this.name = 'ShortLinkIdExhaustedError';
  }
}

// Makes the transaction's last reads, then the link write: the caller reads before calling this
// and writes only after it (Firestore refuses a read after a write in one transaction).
export async function runShortLinkCreate<Type, Metadata>(
  transaction: ServerTransaction,
  request: ShortLinkCreateRequest<Type, Metadata>,
): Promise<ShortLinkCreateResult> {
  const existing = await transaction.get(
    request.links.where('destinationUrl', '==', request.destinationUrl).limit(1),
  );
  const found = existing.docs[0];
  if (found !== undefined) return { shortId: found.id, created: false };

  let free: ServerDocRef | null = null;
  for (let attempt = 0; attempt < SHORT_LINK_ID_MAX_ATTEMPTS && free === null; attempt++) {
    const candidate = request.links.doc(generateShortLinkId(request.randomBytes));
    if (!(await transaction.get(candidate)).exists) free = candidate;
  }
  if (free === null) throw new ShortLinkIdExhaustedError();

  const link: ShortLinkDocument<Type, Metadata> = {
    shortId: free.id,
    destinationUrl: request.destinationUrl,
    type: request.type,
    metadata: request.metadata,
    createdAt: request.now,
    createdBy: request.createdBy,
    clicks: 0,
  };
  transaction.set(free, link);
  return { shortId: free.id, created: true };
}
