import { describe, it, expect } from 'vitest';
import { findHandTypedFirestorePaths } from '../../src/modules/firestore/test-paths.js';
import { COLLECTIONS } from './fixture-core/index.js';

const collectionNames = Object.values(COLLECTIONS);
const offenders = (files) => findHandTypedFirestorePaths(files, { collectionNames });

const PROFILES = COLLECTIONS.USER_PROFILES;
const RESERVED = COLLECTIONS.RESERVED_DISPLAY_NAMES;
const PUBLIC = COLLECTIONS.PUBLIC_USERS;

describe('findHandTypedFirestorePaths', () => {
  it('needs the core collection names', () => {
    expect(() => findHandTypedFirestorePaths([], { collectionNames: [] })).toThrow(
      /collection names/,
    );
  });

  it('FLAGS a path beginning with a collection name in every quote style, with or without a hole', () => {
    expect(
      offenders([
        {
          path: 'functions/src/users/probe.test.ts',
          content: [
            `const RESERVATION = "${RESERVED}/pointguard";`,
            `docs.set('${PROFILES}/uid-a', profile);`,
            'const other = `' + PROFILES + '/${uid}/privateData/${uid}`;',
            `expect(path).toBe(\`${PUBLIC}/u1\`);`,
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'functions/src/users/probe.test.ts:1',
      'functions/src/users/probe.test.ts:2',
      'functions/src/users/probe.test.ts:3',
      'functions/src/users/probe.test.ts:4',
    ]);
  });

  it('FLAGS a collection name handed to doc / collection / collectionGroup as a segment', () => {
    expect(
      offenders([
        {
          path: 'src/__tests__/rules/probe.rules.test.ts',
          content: [
            `await getDoc(doc(db, '${PROFILES}', uid));`,
            `await db.collection('${PUBLIC}').get();`,
            `await ctx.firestore().collectionGroup("${RESERVED}").get();`,
            `const ref = adminDb.doc('${PROFILES}', 'x');`,
          ].join('\n'),
        },
      ]),
    ).toEqual([
      'src/__tests__/rules/probe.rules.test.ts:1',
      'src/__tests__/rules/probe.rules.test.ts:2',
      'src/__tests__/rules/probe.rules.test.ts:3',
      'src/__tests__/rules/probe.rules.test.ts:4',
    ]);
  });

  it('PASSES builder calls, constants, a bare name outside a segment call, comments, and prose', () => {
    expect(
      offenders([
        {
          path: 'functions/src/users/probe.test.ts',
          content: [
            'const RESERVATION = toPath(PATH_BUILDERS.reservedDisplayName("PointGuard"));',
            'await getDoc(doc(db, ...PATH_BUILDERS.userProfile(uid)));',
            'await db.collection(COLLECTIONS.PUBLIC_USERS).get();',
            `const name = '${PROFILES}';`,
            `expect(collections).toContain('${PUBLIC}');`,
            `const note = 'my${PROFILES}/is not a collection path';`,
            '`${COLLECTIONS.USER_PROFILES}/unknown`;',
            `// seeds ${PROFILES}/uid-a through the builder`,
            `/* ${PUBLIC}/u1 is the mirror */`,
            "docs.set('users/uid-a', legacyProfile);",
          ].join('\n'),
        },
      ]),
    ).toEqual([]);
  });

  it("PASSES a path quoted inside a test's name, and a source snippet a guard test feeds to another guard", () => {
    expect(
      offenders([
        {
          path: 'functions/src/users/probe.test.ts',
          content: [
            'it("writes the profile at `' + PROFILES + '/{uid}`", () => {});',
            `const snippet = "db.doc('${PROFILES}/forged').set(event);";`,
            `const segments = "doc(db, '${PROFILES}', uid)";`,
          ].join('\n'),
        },
      ]),
    ).toEqual([]);
  });

  it('FLAGS a path opening a JSX attribute string, and reads JavaScript test files', () => {
    expect(
      offenders([
        {
          path: 'src/__tests__/components/probe.test.tsx',
          content: `const view = <Row path="${PROFILES}/u1" />;`,
        },
        { path: 'scripts/__tests__/probe.test.mjs', content: `writer.set('${PUBLIC}/u2', {});` },
      ]),
    ).toEqual(['src/__tests__/components/probe.test.tsx:1', 'scripts/__tests__/probe.test.mjs:1']);
  });
});
