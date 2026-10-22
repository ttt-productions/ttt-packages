import type { ServerDocSnapshot, ServerQuery } from './types.js';

// A range query inside a transaction range-locks the whole queue, so candidates are found outside it and claimed one document at a time.
export const MAX_CLAIM_ROUNDS = 5;

export function createCandidateCursor(buildQuery: () => ServerQuery) {
  let after: ServerDocSnapshot | undefined;
  return {
    async next(): Promise<ServerDocSnapshot | undefined> {
      const query = after ? buildQuery().startAfter(after) : buildQuery();
      const snapshot = await query.limit(1).get();
      return snapshot.docs[0];
    },
    skip(candidate: ServerDocSnapshot): void {
      after = candidate;
    },
  };
}
