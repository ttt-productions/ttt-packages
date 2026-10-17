// A singleton the core places in a client-readable collection names the reader that needs that
// audience; one no client reads belongs in a server-only collection.

import { afterAll, describe, expect, it } from 'vitest';
import {
  singletonBucketAudienceGuard,
  type SingletonBucketAudienceFacts,
} from '../../src/modules/core-definitions/singleton-bucket-audience.js';
import { CORE, fixture, lines } from './fixture.js';

const facts = (overrides: Partial<SingletonBucketAudienceFacts> = {}): SingletonBucketAudienceFacts => ({
  clientReadableBuckets: async () => ['_open', '_signed'],
  registeredDocumentPaths: () => ['_open/app', 'users/{uid}', '_server/jobs', '_signed/list'],
  pathBuilders: () => ({
    app: () => ['_open', 'app'],
    user: (uid: string) => ['users', uid],
    banner: () => ['_open', 'banner'],
    jobs: () => ['_server', 'jobs'],
  }),
  reviewed: [
    { path: '_open/app', why: 'the shell reads the version gate signed out' },
    { path: '_open/banner', why: 'the landing page renders it signed out' },
    { path: '_signed/list', why: 'a signed-in view reads it from the client' },
  ],
  ...overrides,
});

const f = fixture({ [`${CORE}/kinds.js`]: 'export const KIND = 1;' });
afterAll(() => f.repo.remove());

describe('singleton bucket audience', () => {
  it('passes reviewed client-readable singletons and leaves server-only and per-user documents alone', async () => {
    const [guard] = singletonBucketAudienceGuard.build(facts());
    expect(lines(await f.run(guard))).toEqual([]);
  });

  it('FLAGS an unreviewed singleton from the registry, one only a path builder names, and a reviewed entry that left the buckets', async () => {
    const [guard] = singletonBucketAudienceGuard.build(
      facts({
        registeredDocumentPaths: () => ['_open/app', '_signed/list', '_signed/roster'],
        reviewed: [
          { path: '_open/app', why: 'the shell reads the version gate signed out' },
          { path: '_signed/list', why: 'a signed-in view reads it from the client' },
          { path: '_open/retired', why: 'a page that no longer exists' },
        ],
      }),
    );
    expect(lines(await f.run(guard))).toEqual([
      '(core) _open/banner — a client-readable singleton names no reader that needs its audience',
      '(core) _signed/roster — a client-readable singleton names no reader that needs its audience',
      '(core) _open/retired — stale reviewed entry: the document is no longer in a client-readable collection',
    ]);
  });

  it('FLAGS a run that loads no client-readable collection', async () => {
    const [guard] = singletonBucketAudienceGuard.build(facts({ clientReadableBuckets: () => [], reviewed: [] }));
    expect(lines(await f.run(guard))).toEqual(['(core) clientReadableBuckets — no client-readable collection was loaded']);
  });

  it('refuses missing loaders and a reviewed entry with no why', () => {
    expect(
      singletonBucketAudienceGuard.factProblems({
        ...facts(),
        pathBuilders: undefined as never,
        reviewed: [{ path: '_open/app', why: '' }],
      }),
    ).toEqual(['pathBuilders needs a loader that reads it from the core package', 'reviewed entry _open/app carries no why']);
  });
});
