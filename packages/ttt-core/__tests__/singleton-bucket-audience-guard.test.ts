// BACKEND-108 — a singleton's bucket IS its read grant, chosen by its least-privileged necessary
// reader: `_appConfig` is readable by anyone, `_systemData` by any signed-in user. A doc placed in
// either must be reviewed here with the reader that needs that audience; a doc no client reads
// belongs in the server-only `_serverData`, which needs no entry. A new doc in a client-readable
// bucket fails until reviewed, and an entry whose doc has left the bucket fails as stale.
import { describe, it, expect } from 'vitest';
import { COLLECTIONS } from '../src/paths/collections';
import { PATH_BUILDERS } from '../src/paths/path-builders';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry';

const CLIENT_READABLE_BUCKETS: readonly string[] = [COLLECTIONS.APP_CONFIG, COLLECTIONS.SYSTEM_DATA];

/** Each client-readable singleton → the reader that needs its bucket's audience. */
const REVIEWED_CLIENT_READABLE_SINGLETONS: Readonly<Record<string, string>> = {
  '_appConfig/app': 'the app shell reads the version gate, maintenance switch and banner before sign-in',
  '_appConfig/futurePlans': 'the public roadmap page renders it signed out',
  '_appConfig/rulesAndAgreements': 'the public Rules & Agreements page renders it signed out',
  '_appConfig/termsOfService': 'the public Terms page renders it signed out',
  '_appConfig/privacyPolicy': 'the public Privacy page renders it signed out',
  '_appConfig/takeItDownPageCopy': 'the no-login Take It Down page renders it',
  '_appConfig/dmcaPolicy': 'the public DMCA page renders it signed out',
  '_systemData/adminList': 'the admin roster panel reads it from the client',
  '_systemData/profanityList': 'the admin word-list view reads it from the client',
  '_systemData/reservedUsernames': 'a word list — signed-in disclosure of the word lists is the deliberate posture',
  '_systemData/blockedFranchiseNames': 'a word list — signed-in disclosure of the word lists is the deliberate posture',
  '_systemData/appMode': 'the app-mode marker, a signed-in doc by BACKEND-108',
};

const inClientReadableBucket = (path: string): boolean =>
  CLIENT_READABLE_BUCKETS.includes(path.split('/')[0] ?? '');

/** Every singleton ttt-core places in a client-readable bucket: registry bindings plus the
 *  fixed-path builders, so a builder added without a registry entry is still seen. */
function declaredClientReadableSingletons(): Set<string> {
  const declared = new Set<string>(Object.keys(COLLECTION_SCHEMAS).filter(inClientReadableBucket));
  for (const builder of Object.values(PATH_BUILDERS) as Array<(...args: string[]) => readonly string[]>) {
    if (builder.length !== 0) continue;
    const path = builder().join('/');
    if (inClientReadableBucket(path)) declared.add(path);
  }
  return declared;
}

describe('singleton bucket audience (BACKEND-108)', () => {
  it('every doc in a client-readable bucket names the reader that needs that audience', () => {
    const unreviewed = [...declaredClientReadableSingletons()].filter(
      (path) => !(path in REVIEWED_CLIENT_READABLE_SINGLETONS),
    );
    expect(unreviewed).toEqual([]);
  });

  it('every reviewed entry still names a doc in a client-readable bucket', () => {
    const declared = declaredClientReadableSingletons();
    const stale = Object.keys(REVIEWED_CLIENT_READABLE_SINGLETONS).filter((path) => !declared.has(path));
    expect(stale).toEqual([]);
  });

  it('every reviewed entry carries its justification', () => {
    const unjustified = Object.entries(REVIEWED_CLIENT_READABLE_SINGLETONS)
      .filter(([, reader]) => reader.trim().length === 0)
      .map(([path]) => path);
    expect(unjustified).toEqual([]);
  });
});
