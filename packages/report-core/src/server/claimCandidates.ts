import type { ServerDocSnapshot, ServerQuery } from './types.js';

/**
 * Walks an ordered candidate queue one task per read. `next()` reads the first candidate after
 * every one `skip()` has moved past; a candidate lost to another admin is not skipped, so the
 * next read re-checks the same position. Each refused candidate therefore costs one one-document
 * read, never a re-read of the queue from its head. `buildQuery` is called per read so a
 * time-bounded query (an expiry cutoff) is evaluated at read time.
 */
export function createCandidateCursor(buildQuery: () => ServerQuery) {
  let after: ServerDocSnapshot | undefined;
  return {
    /** The next candidate, or `undefined` when none is left past the cursor. */
    async next(): Promise<ServerDocSnapshot | undefined> {
      const query = after ? buildQuery().startAfter(after) : buildQuery();
      const snapshot = await query.limit(1).get();
      return snapshot.docs[0];
    },
    /** Move past a refused candidate for the rest of this checkout. */
    skip(candidate: ServerDocSnapshot): void {
      after = candidate;
    },
  };
}
