import { describe, it, expect, beforeAll } from 'vitest';
import {
  createGuardProfile,
  loadRegistry,
  runGuardOnSources,
  VIOLATION_KINDS,
  type GuardProfile,
  type WriteRegistry,
  type WriteViolation,
} from '../../src/modules/firestore/analyzer.js';
import * as fixtureCore from './fixture-core/index.js';
import * as fixtureDocSchemas from './fixture-core/doc-schemas.js';

const SOURCES = {
  core: async () => fixtureCore,
  docSchemas: async () => fixtureDocSchemas,
};
const MAPS = [
  'COLLECTIONS',
  'COLLECTION_GROUPS',
  'USER_PROFILE_SUBCOLLECTIONS',
  'SPORT_GAME_SUBCOLLECTIONS',
  'WAIVER_TEMPLATE_SUBCOLLECTIONS',
  'SPECIAL_DOCS',
];

let registry: WriteRegistry;
beforeAll(async () => {
  registry = await loadRegistry({ sources: SOURCES, constantMapNames: MAPS });
});

const analyze = (profile: GuardProfile, source: string) =>
  runGuardOnSources({ sources: { 'fixture/writer.ts': source }, registry, profile });
const detailsOf = (result: { violations: readonly WriteViolation[] }) =>
  result.violations.map((violation) => violation.detail).join('\n');
const kindsOf = (result: { violations: readonly WriteViolation[] }) =>
  result.violations.map((violation) => violation.kind);

const PREAMBLE = `
import { PATH_BUILDERS, toPath } from '@fixture/core';
const db = getFirestore();
`;

describe('createGuardProfile', () => {
  it('refuses a profile with no core package', () => {
    // @ts-expect-error the profile omits its corePackage to prove the runtime refusal
    expect(() => createGuardProfile({})).toThrow(/corePackage/);
    expect(() => createGuardProfile({ corePackage: '' })).toThrow(/corePackage/);
  });

  it('refuses a transaction type name that is not an identifier', () => {
    expect(() =>
      createGuardProfile({ corePackage: '@fixture/core', transactionTypeNames: ['A|B'] }),
    ).toThrow(/not a type name/);
  });

  it("reads the core's own specifier as canonical, and no other package's", () => {
    const write = (specifier: string) => `
      import { PATH_BUILDERS, toPath } from '${specifier}';
      const db = getFirestore();
      export async function writeIt(uid: string) {
        await db.doc(toPath(PATH_BUILDERS.publicUser(uid))).set({ uid }, { merge: true });
      }
    `;
    const profile = createGuardProfile({ corePackage: '@fixture/core' });
    expect(analyze(profile, write('@fixture/core')).violations).toEqual([]);
    expect(kindsOf(analyze(profile, write('@someone-else/core')))).toContain(
      VIOLATION_KINDS.UNRESOLVED_TARGET,
    );
  });
});

describe('an app type a write handle parameter is annotated with', () => {
  const source = `${PREAMBLE}
    interface SyncSite { set(ref: unknown, data: unknown): void }
    export function writeIt(site: SyncSite, uid: string) {
      site.set(db.doc(toPath(PATH_BUILDERS.publicUser(uid))), { siteHandleUndeclared: 1 });
    }
  `;

  it('is read as a transaction-shaped write handle once the profile names it, so its writes are diffed', () => {
    const result = analyze(
      createGuardProfile({ corePackage: '@fixture/core', transactionTypeNames: ['SyncSite'] }),
      source,
    );
    expect(detailsOf(result)).toContain(
      "'siteHandleUndeclared' is not declared by publicUsers/{userId}",
    );
  });

  it('is never silently dropped when the profile does not name it', () => {
    const result = analyze(createGuardProfile({ corePackage: '@fixture/core' }), source);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

describe("the app's own packages that can hand back a Firestore handle", () => {
  const source = `${PREAMBLE}
    import { openStore } from '@fixture/app-data';
    export function writeIt(uid: string) {
      openStore().set({ storeHandleUndeclared: uid });
    }
  `;

  it('a handle from such a package is never taken as positive evidence that a receiver is not Firestore', () => {
    const result = analyze(
      createGuardProfile({
        corePackage: '@fixture/core',
        handleModulePrefixes: ['@fixture/app-data'],
      }),
      source,
    );
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
