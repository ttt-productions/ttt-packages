import type { ServerDocRef, ServerTransaction } from '@ttt-productions/firebase-helpers/server';

export class ShortLinkMalformedError extends Error {
  constructor(shortId: string) {
    super(`The short link ${shortId} has no destination or click count.`);
    this.name = 'ShortLinkMalformedError';
  }
}

// Answers any caller, signed in or not. A link that does not exist answers null.
export async function runShortLinkLookup(
  transaction: ServerTransaction,
  link: ServerDocRef,
): Promise<{ destinationUrl: string } | null> {
  const snapshot = await transaction.get(link);
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  const destinationUrl = data?.destinationUrl;
  const clicks = data?.clicks;
  if (typeof destinationUrl !== 'string' || typeof clicks !== 'number')
    throw new ShortLinkMalformedError(link.id);
  transaction.update(link, { clicks: clicks + 1 });
  return { destinationUrl };
}
