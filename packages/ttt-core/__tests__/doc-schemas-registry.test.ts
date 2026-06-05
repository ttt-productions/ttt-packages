import { describe, it, expect } from 'vitest';
import {
  COLLECTIONS,
  USER_SUBCOLLECTIONS,
  WORK_PROJECT_SUBCOLLECTIONS,
  NESTED_SUBCOLLECTIONS,
} from '../src/paths/collections';
import { COLLECTION_SCHEMAS, PENDING_COLLECTIONS } from '../src/doc-schemas/registry';

// Collection names that exist only in firestore.rules (no COLLECTIONS constant) — see the
// schema-registry recon (§3). They must still be accounted for: bound or explicitly pending.
const RULES_ONLY_COLLECTIONS = ['auditEvents', 'notificationBroadcastJobs', 'notificationHistory'];

const allCollectionNames = [
  ...Object.values(COLLECTIONS),
  ...Object.values(USER_SUBCOLLECTIONS),
  ...Object.values(WORK_PROJECT_SUBCOLLECTIONS),
  ...Object.values(NESTED_SUBCOLLECTIONS),
  ...RULES_ONLY_COLLECTIONS,
];

const boundSegments = new Set<string>();
for (const key of Object.keys(COLLECTION_SCHEMAS)) {
  for (const seg of key.split('/')) {
    if (!seg.startsWith('{')) boundSegments.add(seg);
  }
}
const pending = new Set<string>(PENDING_COLLECTIONS);

describe('Firestore collection schema registry', () => {
  it('binds or explicitly defers every known collection (no silent gaps)', () => {
    const uncovered = allCollectionNames.filter(
      (name) => !boundSegments.has(name) && !pending.has(name),
    );
    expect(uncovered).toEqual([]);
  });

  it('has no stale PENDING entries (each names a real collection)', () => {
    const known = new Set(allCollectionNames);
    const stale = [...PENDING_COLLECTIONS].filter((name) => !known.has(name));
    expect(stale).toEqual([]);
  });

  it('binds every registry path to a parseable Zod schema', () => {
    for (const schema of Object.values(COLLECTION_SCHEMAS)) {
      expect(typeof schema.safeParse).toBe('function');
    }
  });

  it('closes the recon gap — auditEvents is now in the registry', () => {
    expect(boundSegments.has('auditEvents')).toBe(true);
  });
});
