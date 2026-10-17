// Singleton bucket audience: a singleton document's collection IS its read grant, chosen by its
// least-privileged necessary reader. A document the core places in a client-readable collection is
// reviewed with the reader that needs that audience; a document no client reads belongs in a
// server-only collection, which needs no entry.

import type { Finding } from '../../guard.js';
import type { GenericGuardDefinition } from '../../config.js';
import { coreBuild, loaderProblems, reviewedProblems, type Loader } from './shared.js';

type PathBuilder = (...args: never[]) => readonly string[];

export interface SingletonBucketAudienceFacts {
  /** The collections any client may read (an everyone-readable and a signed-in-readable bucket). */
  clientReadableBuckets: Loader<readonly string[]>;
  /** The document paths the core's schema registry binds. */
  registeredDocumentPaths: Loader<readonly string[]>;
  /** The core's path builders; a builder that takes no argument names a singleton. */
  pathBuilders: Loader<Readonly<Record<string, PathBuilder>>>;
  /** Each client-readable singleton, with the reader that needs its collection's audience. */
  reviewed: ReadonlyArray<{ path: string; why: string }>;
}

export const singletonBucketAudienceGuard: GenericGuardDefinition<SingletonBucketAudienceFacts> = {
  id: 'singletonBucketAudience',
  absentWhen: 'the app keeps no document in a collection its clients can read',
  factProblems(facts) {
    const problems: string[] = [];
    loaderProblems(facts?.clientReadableBuckets, 'clientReadableBuckets', problems);
    loaderProblems(facts?.registeredDocumentPaths, 'registeredDocumentPaths', problems);
    loaderProblems(facts?.pathBuilders, 'pathBuilders', problems);
    reviewedProblems(facts?.reviewed, 'reviewed', 'path', problems);
    return problems;
  },
  build(facts) {
    return [
      {
        title: 'every singleton in a client-readable collection names the reader that needs it',
        description:
          'A document the core places in a client-readable collection — through its schema registry or a path builder ' +
          'that takes no argument — is reviewed with the reader that needs that audience. A new one fails until it is ' +
          'reviewed or moved to a server-only collection, and a reviewed entry whose document has left those ' +
          'collections is stale.',
        async run(context) {
          const findings: Finding[] = [];
          coreBuild(context, findings);
          const buckets = new Set(await facts.clientReadableBuckets());
          if (!buckets.size) findings.push({ file: '(core) clientReadableBuckets', detail: 'no client-readable collection was loaded' });
          const inBucket = (path: string) => buckets.has(path.split('/')[0] ?? '');
          const declared = new Set((await facts.registeredDocumentPaths()).filter(inBucket));
          for (const builder of Object.values(await facts.pathBuilders())) {
            if (typeof builder !== 'function' || builder.length !== 0) continue;
            const path = (builder as () => readonly string[])().join('/');
            if (inBucket(path)) declared.add(path);
          }
          const reviewed = new Set(facts.reviewed.map((e) => e.path));
          for (const path of [...declared].sort()) {
            if (!reviewed.has(path)) findings.push({ file: `(core) ${path}`, detail: 'a client-readable singleton names no reader that needs its audience' });
          }
          for (const path of reviewed) {
            if (!declared.has(path)) findings.push({ file: `(core) ${path}`, detail: 'stale reviewed entry: the document is no longer in a client-readable collection' });
          }
          return findings;
        },
      },
    ];
  },
};
