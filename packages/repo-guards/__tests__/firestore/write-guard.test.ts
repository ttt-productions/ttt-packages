import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import {
  createGuardProfile,
  loadRegistry,
  runGuardOnSources,
  declaredKeys,
  closedCanonicalKeys,
  narrowedDeclaredKeys,
  enumerateWriteCallSites,
  parseFile,
  evaluate,
  VIOLATION_KINDS,
  numericSentinelSegments,
  type WriteGuardException,
  type WriteRecord,
  type WriteRegistry,
  type WriteViolation,
} from '../../src/modules/firestore/analyzer.js';
import { COLLECTION_DOC_ID_FIELDS } from './fixture-core/doc-schemas.js';
import { fixturePackageDeclarations } from './fixture-declarations.js';
import * as fixtureCore from './fixture-core/index.js';
import * as fixtureDocSchemas from './fixture-core/doc-schemas.js';

const FIXTURE_SOURCES = Object.freeze({
  core: async () => fixtureCore,
  docSchemas: async () => fixtureDocSchemas,
  subpaths: Object.freeze({}),
});

const FIXTURE_CONSTANT_MAPS = Object.freeze([
  'COLLECTIONS',
  'COLLECTION_GROUPS',
  'USER_PROFILE_SUBCOLLECTIONS',
  'SPORT_GAME_SUBCOLLECTIONS',
  'WAIVER_TEMPLATE_SUBCOLLECTIONS',
  'SPECIAL_DOCS',
]);

const V1_MODULE = 'functions/src/migration-console/actions/v1-sources.ts';

const PROFILE = createGuardProfile({
  corePackage: '@fixture/core',
  coreLibraryRoot: 'packages/core/src',
  importAliases: { '@/': 'src/' },
  removalOnlyTables: [{ exportName: 'V1_SOURCES', module: V1_MODULE, label: 'V1 source document' }],
});

let registry: WriteRegistry;
beforeAll(async () => {
  registry = await loadRegistry({
    sources: FIXTURE_SOURCES,
    constantMapNames: FIXTURE_CONSTANT_MAPS,
  });
});

function analyze(source: string, { exceptions = [] }: { exceptions?: WriteGuardException[] } = {}) {
  return runGuardOnSources({
    sources: { 'fixture/writer.ts': source },
    registry,
    profile: PROFILE,
    exceptions,
    packageDeclarations: fixturePackageDeclarations,
  });
}

function analyzeSources(
  sources: Record<string, string>,
  { exceptions = [] }: { exceptions?: WriteGuardException[] } = {},
) {
  return runGuardOnSources({
    sources,
    registry,
    profile: PROFILE,
    exceptions,
    packageDeclarations: fixturePackageDeclarations,
  });
}

const kindsOf = (result: { violations: readonly WriteViolation[] }) =>
  result.violations.map((violation) => violation.kind);
const detailsOf = (result: { violations: readonly WriteViolation[] }) =>
  result.violations.map((violation) => violation.detail).join('\n');

const PREAMBLE = `
import { PATH_BUILDERS, COLLECTIONS, toPath } from '@fixture/core';
import { FieldValue } from 'firebase-admin/firestore';
const db = getFirestore();
`;

describe('MUST FAIL — a key the document schema does not declare', () => {
  it('fires on a merge-set', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set({ uid, notDeclaredAnywhere: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain('notDeclaredAnywhere');
    expect(detailsOf(result)).not.toContain("'uid'");
  });

  it("fires on an update()'s DOTTED key, which addresses the TOP-LEVEL field (RULE-STD-BACKEND-104)", () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update({ 'notDeclaredAnywhere.nested': 1 });
      }
    `);
    expect(detailsOf(result)).toContain("'notDeclaredAnywhere' is not declared");
  });

  it('fires through a spread, including a CONDITIONAL spread', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string, hot: boolean) {
        const base = { uid, spreadUndeclared: 1 };
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set({ ...base, ...(hot ? { conditionalUndeclared: 2 } : {}) }, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('spreadUndeclared');
    expect(detailsOf(result)).toContain('conditionalUndeclared');
  });

  it('fires through a computed key resolved from a const string', () => {
    const result = analyze(`${PREAMBLE}
      const FIELD = 'computedUndeclared';
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set({ [FIELD]: 1 }, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('computedUndeclared');
  });

  it('fires through a helper-passed DocumentReference, resolved from the CALL SITE', () => {
    const result = analyze(`${PREAMBLE}
      function stamp(ref: FirebaseFirestore.DocumentReference, now: number) {
        void ref.set({ helperPassedUndeclared: now }, { merge: true });
      }
      export function writeIt(uid: string) {
        stamp(db.doc(toPath(PATH_BUILDERS.publicUser(uid))), Date.now());
      }
    `);
    expect(detailsOf(result)).toContain('helperPassedUndeclared');
    expect(detailsOf(result)).toContain('publicUsers/{userId}');
  });

  it('checks a helper return against EVERY finite target candidate', () => {
    const result = analyze(`${PREAMBLE}
      function configuredRef(uid: string, privateRequest: boolean) {
        return privateRequest
          ? db.doc(toPath(PATH_BUILDERS.userPrivateData(uid)))
          : db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      }
      export function writeIt(uid: string, privateRequest: boolean) {
        configuredRef(uid, privateRequest).set({ displayName: 'only public users have this' }, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('userProfiles/{userId}/privateData/{privateDataId}');
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
  });

  it('fails closed when one helper return branch cannot resolve', () => {
    const result = analyze(`${PREAMBLE}
      function configuredRef(uid: string, known: boolean, mystery: FirebaseFirestore.DocumentReference) {
        return known ? db.doc(toPath(PATH_BUILDERS.publicUser(uid))) : mystery;
      }
      export function writeIt(uid: string, mystery: FirebaseFirestore.DocumentReference) {
        configuredRef(uid, false, mystery).set({ uid }, { merge: true });
      }
    `);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('keeps every candidate from an imported helper return', () => {
    const result = analyzeSources({
      'fixture/refs.ts': `${PREAMBLE}
        export function configuredRef(uid: string, privateRequest: boolean) {
          return privateRequest
            ? db.doc(toPath(PATH_BUILDERS.userPrivateData(uid)))
            : db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        }
      `,
      'fixture/writer.ts': `${PREAMBLE}
        import { configuredRef } from './refs';
        export function writeIt(uid: string, privateRequest: boolean) {
          configuredRef(uid, privateRequest).set({ displayName: 'not valid for every candidate' }, { merge: true });
        }
      `,
    });
    expect(detailsOf(result)).toContain('userProfiles/{userId}/privateData/{privateDataId}');
  });

  it('fires through a payload variable built up by later property assignment', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        const payload: Record<string, never> = { uid };
        payload.assignedUndeclared = 1;
        await ref.set(payload, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('assignedUndeclared');
  });

  it('fires through a static object property carrying either a ref or payload', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const holders = { target: db.doc(toPath(PATH_BUILDERS.publicUser(uid))) };
        const payloads = { patch: { uid, propertyUndeclared: true } };
        await holders.target.set(payloads.patch, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('propertyUndeclared');
  });

  it('follows an imported static object property carrying a canonical path and payload', () => {
    const result = analyzeSources({
      'fixture/constants.ts': `${PREAMBLE}
        export const stored = {
          path: toPath(PATH_BUILDERS.publicUser('fixed')),
          patch: { uid: 'fixed', importedPropertyUndeclared: true },
        };
      `,
      'fixture/writer.ts': `${PREAMBLE}
        import { stored } from './constants';
        export async function writeIt() {
          await db.doc(stored.path).set(stored.patch, { merge: true });
        }
      `,
    });
    expect(detailsOf(result)).toContain('importedPropertyUndeclared');
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('fires through a bounded callback-return payload', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        const payloads = [uid].map((value) => ({ uid: value, callbackUndeclared: true }));
        await ref.set(payloads[0], { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('callbackUndeclared');
  });

  it('follows direct ref/payload carrier properties through a helper call site', () => {
    const result = analyze(`${PREAMBLE}
      function writeCarrier(carrier: { target: FirebaseFirestore.DocumentReference; patch: unknown }) {
        void carrier.target.set(carrier.patch, { merge: true });
      }
      export function writeIt(uid: string) {
        writeCarrier({
          target: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          patch: { uid, carrierUndeclared: true },
        });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
    expect(detailsOf(result)).toContain('carrierUndeclared');
  });

  it('follows a bounded callback carrier without treating an arbitrary callback as trusted', () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(uid: string) {
        const carriers = [{
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          patch: { uid, callbackCarrierUndeclared: true },
        }];
        carriers.forEach((carrier) => {
          void carrier.ref.set(carrier.patch, { merge: true });
        });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
    expect(detailsOf(result)).toContain('callbackCarrierUndeclared');
  });

  it('follows a finite async function-return carrier without trusting a declared return type', () => {
    const result = analyze(`${PREAMBLE}
      async function compose(uid: string) {
        return {
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          patch: { uid, asyncCarrierUndeclared: true },
        };
      }
      export async function writeIt(uid: string) {
        const carrier = await compose(uid);
        await carrier.ref.set(carrier.patch, { merge: true });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
    expect(detailsOf(result)).toContain('asyncCarrierUndeclared');
  });

  it('follows an imported function-return ref bundle through a helper parameter', () => {
    const result = analyzeSources({
      'fixture/refs.ts': `${PREAMBLE}
        export function compose(uid: string) {
          return { ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), patch: { uid } };
        }
      `,
      'fixture/writer.ts': `${PREAMBLE}
        import { compose } from './refs';
        function writeBundle(bundle: { ref: FirebaseFirestore.DocumentReference; patch: unknown }) {
          void bundle.ref.set(bundle.patch, { merge: true });
        }
        export function writeIt(uid: string) {
          const maybeBundle = uid ? compose(uid) : undefined;
          if (maybeBundle) writeBundle(maybeBundle);
        }
      `,
    });
    expect(result.violations).toEqual([]);
  });

  it('follows a direct carrier alongside a disjoint finite conditional spread', () => {
    const result = analyze(`${PREAMBLE}
      function writeBundle(bundle: { ref: FirebaseFirestore.DocumentReference; patch: unknown }) {
        void bundle.ref.set(bundle.patch, { merge: true });
      }
      export function writeIt(uid: string, includeExtra: boolean) {
        writeBundle({
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          patch: { uid },
          ...(includeExtra ? { diagnostic: 'not a carrier property' } : {}),
        });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('follows a destructured finite carrier property', () => {
    const result = analyze(`${PREAMBLE}
      function writeBundle(bundle: { ref: FirebaseFirestore.DocumentReference; patch: unknown }) {
        const { ref, patch } = bundle;
        void ref.set(patch, { merge: true });
      }
      export function writeIt(uid: string) {
        writeBundle({ ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), patch: { uid } });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('follows a destructured property from a finite returned carrier', () => {
    const result = analyze(`${PREAMBLE}
      function compose(uid: string) {
        return { ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), patch: { uid } };
      }
      export function writeIt(uid: string) {
        const { ref, patch } = compose(uid);
        void ref.set(patch, { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('does not trust a finite spread that can overwrite a carrier property', () => {
    const result = analyze(`${PREAMBLE}
      declare function replacement(): { ref: FirebaseFirestore.DocumentReference };
      function writeBundle(bundle: { ref: FirebaseFirestore.DocumentReference; patch: unknown }) {
        void bundle.ref.set(bundle.patch, { merge: true });
      }
      export function writeIt(uid: string, replace: boolean) {
        writeBundle({
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          patch: { uid },
          ...(replace ? replacement() : {}),
        });
      }
    `);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('resolves a Firestore trigger event reference from its declared canonical document path', () => {
    const result = analyze(`${PREAMBLE}
      export const trigger = onDocumentCreated(
        { document: \`${'${COLLECTIONS.PENDING_MEDIA}'}/{docId}\` },
        async (event) => {
          const ref = event.data.ref;
          await ref.update({ status: 'processing' });
        },
      );
    `);
    expect(result.violations).toEqual([]);
  });

  it('does not trust a generic callback event reference without a Firestore trigger declaration', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(event: { data: { ref: FirebaseFirestore.DocumentReference } }) {
        await event.data.ref.update({ status: 'processing' });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('follows every entry in a bounded finite selector registry', () => {
    const entries = Array.from(
      { length: 13 },
      (_, index) =>
        `entry${index}: { ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), patch: { uid } }`,
    ).join(',\n');
    const result = analyze(`${PREAMBLE}
      const registry = { ${entries} };
      export async function writeIt(uid: string, selector: string) {
        const carrier = registry[selector];
        await carrier.ref.set(carrier.patch, { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('fails closed when a selector registry exceeds the finite candidate bound', () => {
    const entries = Array.from(
      { length: 17 },
      (_, index) =>
        `entry${index}: { ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), patch: { uid } }`,
    ).join(',\n');
    const result = analyze(`${PREAMBLE}
      const registry = { ${entries} };
      export async function writeIt(uid: string, selector: string) {
        const carrier = registry[selector];
        await carrier.ref.set(carrier.patch, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('ignores a direct always-throwing path-factory branch because it cannot reach a write', () => {
    const result = analyze(`${PREAMBLE}
      const registry = {
        live: PATH_BUILDERS.publicUser,
        unavailable: () => { throw new Error('unavailable'); },
      };
      export async function writeIt(uid: string, selector: keyof typeof registry) {
        const ref = db.doc(toPath(registry[selector](uid)));
        await ref.set({ uid }, { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('does not ignore a finite path-factory branch that might return at runtime', () => {
    const result = analyze(`${PREAMBLE}
      declare function opaqueBuilder(id: string): string[];
      const registry = { live: PATH_BUILDERS.publicUser, opaque: opaqueBuilder };
      export async function writeIt(uid: string, selector: keyof typeof registry) {
        const ref = db.doc(toPath(registry[selector](uid)));
        await ref.set({ uid }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('follows a below-declared finite builder registry through a returned ref carrier', () => {
    const result = analyze(`${PREAMBLE}
      function compose(uid: string, selector: string) {
        const entry = registry[selector];
        return { ref: db.doc(toPath(entry.build(uid))), patch: { uid } };
      }
      const registry = {
        public: { build: PATH_BUILDERS.publicUser },
        stopped: { build: () => { throw new Error('stopped'); } },
      };
      export async function writeIt(uid: string, selector: string) {
        const carrier = compose(uid, selector);
        await carrier.ref.set(carrier.patch, { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('retains every returning builder in a bounded mixed selector registry', () => {
    const builders = [
      'userProfile',
      'publicUser',
      'statusReconcileQueueEntry',
      'sportLeague',
      'leagueTeam',
      'leagueTeamContact',
      'teamInvitation',
      'teamJoinRequest',
      'sportGame',
      'gameLocation',
      'waiverTemplate',
      'hardwareLoanContract',
    ];
    const entries = builders.map((name) => `${name}: { build: PATH_BUILDERS.${name} }`).join(',\n');
    const result = analyze(`${PREAMBLE}
      const registry = {
        ${entries},
        stopped: { build: () => { throw new Error('stopped'); } },
      };
      export async function writeIt(id: string, selector: string) {
        const ref = db.doc(toPath(registry[selector].build(id)));
        await ref.update({ updatedAt: 1 });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('keeps an opaque function-return carrier fail-closed', () => {
    const result = analyze(`${PREAMBLE}
      declare function compose(uid: string): Promise<{ ref: FirebaseFirestore.DocumentReference; patch: unknown }>;
      export async function writeIt(uid: string) {
        const carrier = await compose(uid);
        await carrier.ref.set(carrier.patch, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('follows a checked optional finite carrier branch', () => {
    const result = analyze(`${PREAMBLE}
      async function compose(uid: string) {
        return { ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), patch: { uid } };
      }
      export async function writeIt(uid: string, enabled: boolean) {
        const carrier = enabled ? await compose(uid) : undefined;
        if (!carrier) return;
        await carrier.ref.set(carrier.patch, { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('does not ignore an opaque non-null carrier branch', () => {
    const result = analyze(`${PREAMBLE}
      declare function opaqueCarrier(): { ref: FirebaseFirestore.DocumentReference; patch: unknown };
      export async function writeIt(uid: string, known: boolean) {
        const carrier = known
          ? { ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), patch: { uid } }
          : opaqueCarrier();
        await carrier.ref.set(carrier.patch, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('fires on a public field written onto the private-data document, which never declares it', () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, uid: string) {
        const privateRef = db.doc(toPath(PATH_BUILDERS.userPrivateData(uid)));
        tx.create(privateRef, {
          email: 'x@example.com',
          updatedAt: 1,
          displayName: 'public only',
        });
      }
    `);
    expect(detailsOf(result)).toContain(
      "'displayName' is not declared by userProfiles/{userId}/privateData/{privateDataId}",
    );
  });
});

describe('MUST FAIL — casts and hand-built paths on a write', () => {
  it('fires on a Record<string, unknown> cast of the payload', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set({ uid } as Record<string, unknown>, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.PAYLOAD_CAST);
  });

  it('fires on a DOUBLE cast of the payload', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set(({ uid } as unknown) as Record<string, unknown>, { merge: true });
      }
    `);
    expect(
      kindsOf(result).filter((kind) => kind === VIOLATION_KINDS.PAYLOAD_CAST).length,
    ).toBeGreaterThan(0);
  });

  it('fires on a hand-built document path feeding a write', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        await db.collection(COLLECTIONS.PUBLIC_USERS).doc(uid).set({ uid }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.HAND_BUILT_PATH);
  });

  it('fires on a document path assembled as a template literal', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        await db.doc(\`\${COLLECTIONS.PUBLIC_USERS}/\${uid}\`).set({ uid }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.HAND_BUILT_PATH);
  });
});

describe('MUST FAIL — fail-closed on what the guard cannot read', () => {
  it('fires when the target document does not resolve', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(mysteryRef: FirebaseFirestore.DocumentReference) {
        await mysteryRef.set({ anything: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('fires when the payload cannot be read', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string, mystery: Record<string, never>) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set(mystery, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('does not trust a safeParse result wrapper or a local alias of a canonical schema', () => {
    const result = analyze(`${PREAMBLE}
      import { PublicUserSchema } from '@fixture/core/doc-schemas';
      const LocalAlias = PublicUserSchema;
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set(PublicUserSchema.safeParse({ uid }), { merge: true });
        await ref.set(LocalAlias.parse({ uid }), { merge: true });
      }
    `);
    expect(
      kindsOf(result).filter((kind) => kind === VIOLATION_KINDS.UNREADABLE_PAYLOAD).length,
    ).toBe(2);
  });

  it('does not trust .data from a local alias of a canonical schema', () => {
    const result = analyze(`${PREAMBLE}
      import { PublicUserSchema } from '@fixture/core/doc-schemas';
      const LocalAlias = PublicUserSchema;
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        const parsed = LocalAlias.safeParse({ uid });
        await ref.set(parsed.data, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('does not resolve a runtime-selected PATH_BUILDERS function', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string, dynamicBuilder: (id: string) => string[]) {
        await db.doc(toPath(dynamicBuilder(uid))).set({ uid }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });
});

describe('a canonical builder that validates a numeric argument', () => {
  it('reads its shape from two whole-number sentinels: differing slots are argument-derived', () => {
    const builder = (waiverTemplateId: unknown, version: unknown) => {
      if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
        throw new Error('whole numbers only');
      return ['waiverTemplates', waiverTemplateId, 'waiverTemplateVersions', `v${version}`];
    };
    expect(numericSentinelSegments(builder)).toEqual([
      'waiverTemplates',
      'ID',
      'waiverTemplateVersions',
      'ID',
    ]);
    expect(
      numericSentinelSegments(() => {
        throw new Error('never runs');
      }),
    ).toBeNull();
  });

  it('resolves a write through it, and still fails an undeclared key there', () => {
    const declared = analyze(`${PREAMBLE}
      export async function writeIt(waiverTemplateId: string, version: number) {
        await db.doc(toPath(PATH_BUILDERS.waiverTemplateVersion(waiverTemplateId, version))).create({
          version, title: 't', waiverText: 'w', publishedByUserId: 'u', publishedAt: 1,
        });
      }
    `);
    expect(declared.violations).toEqual([]);

    const undeclared = analyze(`${PREAMBLE}
      export async function writeIt(waiverTemplateId: string, version: number) {
        await db.doc(toPath(PATH_BUILDERS.waiverTemplateVersion(waiverTemplateId, version))).create({
          version, notDeclaredOnVersions: true,
        });
      }
    `);
    expect(detailsOf(undeclared)).toContain('notDeclaredOnVersions');
  });
});

describe('MUST PASS — the documented non-violations', () => {
  it('minting an auto-id with collection(COLLECTIONS.X).doc() is not a hand-built path', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt() {
        const ref = db.collection(COLLECTIONS.PUBLIC_USERS).doc();
        await ref.set({ uid: ref.id }, { merge: true });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.HAND_BUILT_PATH);
    expect(result.violations).toEqual([]);
  });

  it('a collection reference built for a QUERY is not a write at all', () => {
    const result = analyze(`${PREAMBLE}
      export async function readIt() {
        const snap = await db.collection(COLLECTIONS.PUBLIC_USERS).where('disabled', '==', true).limit(10).get();
        return snap.docs.length;
      }
    `);
    expect(result.writes).toEqual([]);
    expect(result.violations).toEqual([]);
  });

  it('a Firestore sentinel on a DECLARED field passes — the sentinel still names the field', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update({
          updatedAt: FieldValue.increment(1),
          selectedBadges: FieldValue.delete(),
          displayName: FieldValue.arrayUnion('x'),
        });
      }
    `);
    expect(result.violations).toEqual([]);
    expect(result.writes[0].keys.sort()).toEqual(['displayName', 'selectedBadges', 'updatedAt']);
  });

  it('a sentinel on an UNDECLARED field still fires — the field name is what is checked', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update({ sentinelUndeclared: FieldValue.delete() });
      }
    `);
    expect(detailsOf(result)).toContain('sentinelUndeclared');
  });

  it('a Map/Set held in a React ref is never mistaken for a Firestore write', () => {
    const result = analyze(`
      const seenRef = { current: new Set<string>() };
      export function mark(id: string) {
        seenRef.current.add(id);
      }
    `);
    expect(result.writes).toEqual([]);
  });

  it('resolves QuerySnapshot.forEach and a typed snapshot.docs loop', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt() {
        const snap = await db.collection(COLLECTIONS.PUBLIC_USERS).get();
        snap.forEach((doc) => { void doc.ref.set({ uid: doc.id }, { merge: true }); });
        const docs: FirebaseFirestore.QueryDocumentSnapshot[] = snap.docs;
        for (const doc of docs) void doc.ref.set({ uid: doc.id }, { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
    expect(result.writes).toHaveLength(2);
  });

  it('accepts a direct closed core schema .parse() output and checks its actual output keys', () => {
    const result = analyze(`${PREAMBLE}
      import { PublicUserSchema } from '@fixture/core/doc-schemas';
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set(PublicUserSchema.parse({ uid }), { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('accepts .data from a direct closed core schema safeParse() result', () => {
    const result = analyze(`${PREAMBLE}
      import { PublicUserSchema } from '@fixture/core/doc-schemas';
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        const parsed = PublicUserSchema.safeParse({ uid });
        if (!parsed.success) return;
        await ref.set(parsed.data, { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('accepts direct canonical factory-produced document schemas through parse and safeParse data', () => {
    const result = analyze(`${PREAMBLE}
      import { PendingMediaSchema } from '@fixture/core/doc-schemas';
      export async function writeIt(id: string, raw: unknown) {
        const pending = PendingMediaSchema.safeParse(raw);
        if (pending.success) {
          await db.doc(toPath(PATH_BUILDERS.pendingMedia(id))).set(pending.data, { merge: true });
        }
        await db.doc(toPath(PATH_BUILDERS.pendingMedia(id))).set(PendingMediaSchema.parse(raw), { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('accepts a renamed direct import of a closed core schema', () => {
    const result = analyze(`${PREAMBLE}
      import { PublicUserSchema as CanonicalPublicUser } from '@fixture/core/doc-schemas';
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set(CanonicalPublicUser.parse({ uid }), { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('accepts a direct ref/payload carrier passed to a helper when both sides are readable', () => {
    const result = analyze(`${PREAMBLE}
      function writeCarrier(carrier: { target: FirebaseFirestore.DocumentReference; patch: unknown }) {
        void carrier.target.set(carrier.patch, { merge: true });
      }
      export function writeIt(uid: string) {
        writeCarrier({
          target: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          patch: { uid },
        });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('accepts a bounded callback carrier whose ref and payload are both readable', () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(uid: string) {
        const carriers = [{
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          patch: { uid },
        }];
        carriers.forEach((carrier) => {
          void carrier.ref.set(carrier.patch, { merge: true });
        });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('keeps a finite same-carrier target/payload branch correlated, not cross-producted', () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(uid: string, privateRequest: boolean) {
        const choice = privateRequest
          ? {
              target: db.doc(toPath(PATH_BUILDERS.userPrivateData(uid))),
              patch: { email: 'requester@example.com', updatedAt: 1 },
            }
          : {
              target: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
              patch: { displayName: 'public user' },
            };
        void choice.target.set(choice.patch, { merge: true });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('still checks every correlated branch independently', () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(uid: string, privateRequest: boolean) {
        const choice = privateRequest
          ? {
              target: db.doc(toPath(PATH_BUILDERS.userPrivateData(uid))),
              patch: { correlatedBranchUndeclared: true },
            }
          : {
              target: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
              patch: { displayName: 'public user' },
            };
        void choice.target.set(choice.patch, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain('userProfiles/{userId}/privateData/{privateDataId}');
  });

  it('keeps a carrier PARAMETER correlated per call site instead of cross-producting callers', () => {
    const result = analyze(`${PREAMBLE}
      function commit(entry: { ref: FirebaseFirestore.DocumentReference; data: unknown }) {
        void entry.ref.set(entry.data, { merge: true });
      }
      export function writePublic(uid: string) {
        commit({ ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), data: { displayName: 'public' } });
      }
      export function writePrivate(requestId: string) {
        commit({
          ref: db.doc(toPath(PATH_BUILDERS.userPrivateData(requestId))),
          data: { email: 'requester@example.com', updatedAt: 1 },
        });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('MUST FAIL — a carrier parameter whose call site MIS-PAIRS its document and its payload', () => {
    const result = analyze(`${PREAMBLE}
      function commit(entry: { ref: FirebaseFirestore.DocumentReference; data: unknown }) {
        void entry.ref.set(entry.data, { merge: true });
      }
      export function writePublic(uid: string) {
        commit({ ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), data: { email: 'wrong lane' } });
      }
      export function writePrivate(requestId: string) {
        commit({
          ref: db.doc(toPath(PATH_BUILDERS.userPrivateData(requestId))),
          data: { email: 'requester@example.com', updatedAt: 1 },
        });
      }
    `);
    expect(detailsOf(result)).toContain("'email' is not declared by publicUsers/{userId}");
  });

  it('pairs a carrier ref with the patch its OWN call site builds, through a local const', () => {
    const result = analyze(`${PREAMBLE}
      function claim(args: {
        ref: FirebaseFirestore.DocumentReference;
        claimPatch: (now: number) => unknown;
      }) {
        const claimPatch = args.claimPatch(Date.now());
        void args.ref.set(claimPatch, { merge: true });
      }
      export function claimPublic(uid: string) {
        claim({
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          claimPatch: () => ({ displayName: 'public' }),
        });
      }
      export function claimPrivate(requestId: string) {
        claim({
          ref: db.doc(toPath(PATH_BUILDERS.userPrivateData(requestId))),
          claimPatch: () => ({ email: 'requester@example.com', updatedAt: 1 }),
        });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it("MUST FAIL — an undeclared key in ONE call site's patch builder, named on THAT document", () => {
    const result = analyze(`${PREAMBLE}
      function claim(args: {
        ref: FirebaseFirestore.DocumentReference;
        claimPatch: (now: number) => unknown;
      }) {
        const claimPatch = args.claimPatch(Date.now());
        void args.ref.set(claimPatch, { merge: true });
      }
      export function claimPublic(uid: string) {
        claim({
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          claimPatch: () => ({ carrierPairUndeclared: 1 }),
        });
      }
      export function claimPrivate(requestId: string) {
        claim({
          ref: db.doc(toPath(PATH_BUILDERS.userPrivateData(requestId))),
          claimPatch: () => ({ email: 'requester@example.com', updatedAt: 1 }),
        });
      }
    `);
    expect(detailsOf(result)).toContain(
      "'carrierPairUndeclared' is not declared by publicUsers/{userId}",
    );
    expect(detailsOf(result)).not.toContain('privateData');
  });

  it('MUST FAIL — a patch builder whose call site MIS-PAIRS the lane it is written to', () => {
    const result = analyze(`${PREAMBLE}
      function claim(args: {
        ref: FirebaseFirestore.DocumentReference;
        claimPatch: (now: number) => unknown;
      }) {
        const claimPatch = args.claimPatch(Date.now());
        void args.ref.set(claimPatch, { merge: true });
      }
      export function claimPublic(uid: string) {
        claim({
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          claimPatch: () => ({ email: 'wrong lane' }),
        });
      }
      export function claimPrivate(requestId: string) {
        claim({
          ref: db.doc(toPath(PATH_BUILDERS.userPrivateData(requestId))),
          claimPatch: () => ({ email: 'requester@example.com', updatedAt: 1 }),
        });
      }
    `);
    expect(detailsOf(result)).toContain("'email' is not declared by publicUsers/{userId}");
  });

  it('MUST FAIL — an unreadable patch builder at one call site still fails closed', () => {
    const result = analyze(`${PREAMBLE}
      function claim(args: {
        ref: FirebaseFirestore.DocumentReference;
        claimPatch: (now: number) => unknown;
      }) {
        const claimPatch = args.claimPatch(Date.now());
        void args.ref.set(claimPatch, { merge: true });
      }
      export function claimPublic(uid: string, mystery: (now: number) => unknown) {
        claim({ ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), claimPatch: mystery });
      }
      export function claimPrivate(requestId: string) {
        claim({
          ref: db.doc(toPath(PATH_BUILDERS.userPrivateData(requestId))),
          claimPatch: () => ({ email: 'requester' }),
        });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('MUST FAIL — a REASSIGNED patch local is not one carrier value, so the pairing is refused', () => {
    const result = analyze(`${PREAMBLE}
      function claim(args: {
        ref: FirebaseFirestore.DocumentReference;
        claimPatch: (now: number) => unknown;
      }, swap: boolean) {
        let claimPatch = args.claimPatch(Date.now());
        if (swap) claimPatch = { reassignedUndeclared: 1 };
        void args.ref.set(claimPatch, { merge: true });
      }
      export function claimPublic(uid: string) {
        claim({
          ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          claimPatch: () => ({ displayName: 'public' }),
        }, false);
      }
    `);
    expect(detailsOf(result)).toContain(
      "'reassignedUndeclared' is not declared by publicUsers/{userId}",
    );
  });

  it('resolves a finite config-selected PATH_BUILDERS alias without trusting a dynamic builder', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string, privateRequest: boolean) {
        const builder = privateRequest
          ? PATH_BUILDERS.userPrivateData
          : PATH_BUILDERS.publicUser;
        const ref = db.doc(toPath(builder(uid)));
        await ref.set({ displayName: 'only public users have this' }, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('userProfiles/{userId}/privateData/{privateDataId}');
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
  });
});

describe('write FORMS the guard must see', () => {
  const forms = {
    'tx.set(ref, data)': 'tx.set(ref, { formUndeclared: 1 }, { merge: true });',
    'tx.create(ref, data)': 'tx.create(ref, { formUndeclared: 1 });',
    'tx.update(ref, data)': 'tx.update(ref, { formUndeclared: 1 });',
    'batch.set(ref, data)': 'batch.set(ref, { formUndeclared: 1 }, { merge: true });',
    'ref.set(data)': 'void ref.set({ formUndeclared: 1 }, { merge: true });',
    'ref.create(data)': 'void ref.create({ formUndeclared: 1 });',
    'ref.update(data)': 'void ref.update({ formUndeclared: 1 });',
    "ref.update('path', value)": "void ref.update('formUndeclared', 1);",
  };
  for (const [name, statement] of Object.entries(forms)) {
    it(`sees ${name}`, () => {
      const result = analyze(`${PREAMBLE}
        export function writeIt(tx: FirebaseFirestore.Transaction, uid: string) {
          const batch = db.batch();
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          ${statement}
        }
      `);
      expect(detailsOf(result), name).toContain('formUndeclared');
    });
  }

  it('sees collectionRef.add(data), whose auto-id document is still a registered shape', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt() {
        await db.collection(COLLECTIONS.PUBLIC_USERS).add({ formUndeclared: 1 });
      }
    `);
    expect(detailsOf(result)).toContain('formUndeclared');
  });
});

describe('scope awareness', () => {
  it('never matches a variable to a same-named declaration in ANOTHER function', () => {
    const result = analyze(`${PREAMBLE}
      function somewhereElse(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        void ref.set({ uid }, { merge: true });
      }
      export function writeIt(ref: FirebaseFirestore.DocumentReference) {
        void ref.set({ displayName: 'x' }, { merge: true });
      }
    `);
    const unresolved = result.violations.filter(
      (violation) => violation.kind === VIOLATION_KINDS.UNRESOLVED_TARGET,
    );
    expect(unresolved.length).toBe(1);
    expect(result.writes.find((write) => write.line > 8)?.templates).toBeNull();
  });
});

describe('the exception list', () => {
  const source = `${PREAMBLE}
    export async function writeIt(uid: string) {
      const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      await ref.set({ exceptedField: 1 }, { merge: true });
    }
  `;

  it('excuses exactly the reviewed write, and records the justification', () => {
    const result = analyze(source, {
      exceptions: [
        {
          kind: VIOLATION_KINDS.UNDECLARED_FIELD,
          file: 'fixture/writer.ts',
          fn: 'writeIt',
          marker: 'exceptedField',
          field: 'exceptedField',
          why: 'fixture — proves an exception matches by content, not by file',
        },
      ],
    });
    expect(result.violations).toEqual([]);
    expect(result.applied[0].why).toContain('fixture');
  });

  it('does NOT excuse a different violation in the same file', () => {
    const result = analyze(
      `${PREAMBLE}
        export async function writeIt(uid: string) {
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          await ref.set({ exceptedField: 1 }, { merge: true });
          await ref.set({ someOtherUndeclaredField: 1 }, { merge: true });
        }
      `,
      {
        exceptions: [
          {
            kind: VIOLATION_KINDS.UNDECLARED_FIELD,
            file: 'fixture/writer.ts',
            fn: 'writeIt',
            marker: 'exceptedField',
            field: 'exceptedField',
            why: 'fixture',
          },
        ],
      },
    );
    expect(detailsOf(result)).toContain('someOtherUndeclaredField');
    expect(detailsOf(result)).not.toContain('exceptedField');
  });

  it('reports an exception that matches nothing, so a stale entry is deleted not kept', () => {
    const result = analyze(source, {
      exceptions: [
        {
          kind: VIOLATION_KINDS.PAYLOAD_CAST,
          file: 'fixture/writer.ts',
          marker: 'gone',
          detail: 'never',
          why: 'fixture',
        },
      ],
    });
    expect(result.staleExceptions.length).toBe(1);
  });
});

describe('declaredKeys over the schema shapes the registry actually holds', () => {
  it('a UNION declares a key when ANY member declares it', () => {
    const schema = z.union([z.object({ a: z.string() }), z.object({ b: z.string() })]);
    expect([...(declaredKeys(schema)?.keys ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('a DISCRIMINATED union declares every member key', () => {
    const schema = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('one'), a: z.string() }),
      z.object({ kind: z.literal('two'), b: z.string() }),
    ]);
    expect([...(declaredKeys(schema)?.keys ?? [])].sort()).toEqual(['a', 'b', 'kind']);
  });

  it('an INTERSECTION declares both sides', () => {
    const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() }));
    expect([...(declaredKeys(schema)?.keys ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('a wrapped object is unwrapped', () => {
    expect([...(declaredKeys(z.object({ a: z.string() }).optional())?.keys ?? [])]).toEqual(['a']);
  });

  it('a record schema is OPEN — there is nothing to diff, and the guard says so', () => {
    expect(declaredKeys(z.record(z.string(), z.unknown()))).toBeNull();
  });

  it('never treats a top-level open, unknown, or transformed schema as a canonical parse source', () => {
    expect(closedCanonicalKeys(z.object({ a: z.string() }).passthrough())).toBeNull();
    expect(closedCanonicalKeys(z.unknown())).toBeNull();
    expect(closedCanonicalKeys(z.object({ a: z.string() }).transform((value) => value))).toBeNull();
  });

  it('allows a closed document schema whose nested value is open', () => {
    expect([
      ...(closedCanonicalKeys(z.object({ metadata: z.record(z.string(), z.unknown()) }))?.keys ??
        []),
    ]).toEqual(['metadata']);
  });
});

describe('MUST FAIL — a write a name-based classifier would drop silently', () => {
  it('fires on a DocumentReference-typed local whose NAME says nothing about Firestore', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(target: FirebaseFirestore.DocumentReference) {
        await target.set({ anything: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(result.writes).toHaveLength(1);
  });

  it('fires on a write through a handle carried on an opaque context object', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(context: { destination: FirebaseFirestore.DocumentReference }) {
        await context.destination.update({ anything: 1 });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('still drops a Map/Set/URLSearchParams receiver — on POSITIVE evidence, with a reason', () => {
    const result = analyze(`
      export function mark(url: URL, id: string, label: string) {
        const seen = new Set<string>();
        const counts = new Map<string, number>();
        seen.add(id);
        counts.set(id, 1);
        url.searchParams.set('page', label);
      }
    `);
    expect(result.writes).toEqual([]);
    expect(result.violations).toEqual([]);
    expect(result.notFirestore.map((entry) => entry.reason).join('\n')).toContain('new Set()');
  });

  it('drops a Map parameter by its declared TYPE, not by its name', () => {
    const result = analyze(`
      export function mark(refs: Map<string, number>, id: string) {
        refs.set(id, 1);
      }
    `);
    expect(result.writes).toEqual([]);
    expect(result.violations).toEqual([]);
  });

  it('ignores an unreviewed @firestoreTarget tag — a comment can never exempt a write', () => {
    const result = analyze(`${PREAMBLE}
      /** @firestoreTarget publicUser */
      export async function writeIt(chosen: FirebaseFirestore.DocumentReference) {
        await chosen.set({ anything: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });
});

describe('the independent structural cross-check', () => {
  const mixed = `${PREAMBLE}
    export async function writeIt(uid: string, id: string) {
      const seen = new Set<string>();
      seen.add(id);
      const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      await ref.set({ uid }, { merge: true });
      await ref.update({ displayName: 'x' });
    }
  `;

  it('accounts for EVERY write-method call site as a write or as positive not-Firestore evidence', () => {
    const files = [parseFile('fixture/writer.ts', mixed)];
    const sites = enumerateWriteCallSites(files);
    const result = analyze(mixed);
    const accounted = new Set([
      ...result.writes.map((write) => `${write.file}@${write.pos}`),
      ...result.notFirestore.map((entry) => `${entry.file}@${entry.pos}`),
    ]);
    expect(sites.filter((site) => !accounted.has(`${site.file}@${site.pos}`))).toEqual([]);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNCLASSIFIED_CALL);
  });

  it('FAILS when a call site the classifier never saw is present', () => {
    const registryStub = {
      declaredFor: () => ({ keys: new Set<string>(), open: false }),
      schemaFor: () => null,
    };
    const result = evaluate({
      writes: [],
      notFirestore: [],
      registry: registryStub,
      trees: ['fixture'],
      callSites: [
        {
          file: 'fixture/writer.ts',
          pos: 42,
          method: 'set',
          at: 'fixture/writer.ts:3',
          snippet: 'x.set(y)',
        },
      ],
    });
    expect(result.violations.map((violation) => violation.kind)).toEqual([
      VIOLATION_KINDS.UNCLASSIFIED_CALL,
    ]);
  });
});

describe('MUST FAIL — a registered template whose declared keys cannot be read', () => {
  const stubRegistry = (schema: unknown) => ({
    declaredFor: () => declaredKeys(schema),
    schemaFor: () => schema,
  });

  const oneWrite = (keys: string[]): WriteRecord[] => [
    {
      file: 'fixture/writer.ts',
      line: 3,
      pos: 10,
      at: 'fixture/writer.ts:3',
      method: 'set',
      fn: 'writeIt',
      snippetOrdinal: 1,
      snippet: 'ref.set(patch)',
      templates: ['waiverTemplates/{waiverTemplateId}'],
      unresolvedReason: null,
      handBuilt: false,
      keys,
      casts: [],
      opaque: null,
      literals: new Map(),
      correlatedBranches: null,
    },
  ];

  it('reports an undiffable template instead of counting the payload as checked', () => {
    const wrapped = z.preprocess((value) => value, z.object({ declared: z.string() }));
    const result = evaluate({
      writes: oneWrite(['declared', 'undeclaredAnywhere']),
      registry: stubRegistry(wrapped),
      trees: ['fixture'],
    });
    expect(result.violations.map((violation) => violation.kind)).toEqual([
      VIOLATION_KINDS.UNDIFFABLE_TEMPLATE,
    ]);
    expect([...result.coverage.values()][0].payloadsRead).toBe(0);
    expect([...result.coverage.values()][0].payloadsParsed).toBe(1);
  });

  it('MUST FAIL: an undiffable SOLE candidate is never excusable', () => {
    const wrapped = z.preprocess((value) => value, z.object({ declared: z.string() }));
    const result = evaluate({
      writes: oneWrite(['declared']),
      registry: stubRegistry(wrapped),
      trees: ['fixture'],
      exceptions: [
        {
          kind: VIOLATION_KINDS.UNDIFFABLE_TEMPLATE,
          file: 'fixture/writer.ts',
          marker: 'waiverTemplates',
          why: 'fixture — must NOT excuse a sole undiffable candidate',
        },
      ],
    });
    expect(result.violations.map((violation) => violation.kind)).toEqual([
      VIOLATION_KINDS.UNDIFFABLE_TEMPLATE,
    ]);
  });

  it('is excusable when it is one candidate among several that ARE diffable', () => {
    const wrapped = z.preprocess((value) => value, z.object({ declared: z.string() }));
    const readable = z.object({ declared: z.string() });
    const write = { ...oneWrite(['declared'])[0], templates: ['undiffable/{id}', 'readable/{id}'] };
    const result = evaluate({
      writes: [write],
      registry: {
        declaredFor: (template: string) =>
          declaredKeys(template === 'undiffable/{id}' ? wrapped : readable),
        schemaFor: (template: string) => (template === 'undiffable/{id}' ? wrapped : readable),
      },
      trees: ['fixture'],
      exceptions: [
        {
          kind: VIOLATION_KINDS.UNDIFFABLE_TEMPLATE,
          file: 'fixture/writer.ts',
          fn: 'writeIt',
          marker: 'ref.set(patch)',
          detail:
            "'undiffable/{id}' has no readable declared keys (a wrapper/record/open schema), so this payload was diffed against nothing",
          why: 'fixture — the other candidate still diffs the payload',
        },
      ],
    });
    expect(result.violations).toEqual([]);
  });

  it('counts a readable template as VERIFIED, not merely parsed', () => {
    const result = evaluate({
      writes: oneWrite(['declared']),
      registry: stubRegistry(z.object({ declared: z.string() })),
      trees: ['fixture'],
    });
    expect(result.violations).toEqual([]);
    expect([...result.coverage.values()][0].payloadsRead).toBe(1);
  });
});

describe('MUST FAIL — every visible assignment of a payload variable is read', () => {
  it('unions the keys of EVERY branch that assigns the payload', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string, hot: boolean) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        let patch = { uid };
        if (hot) patch = { uid, reassignedUndeclared: 1 };
        await ref.set(patch, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('reassignedUndeclared');
  });

  it('is opaque when ANY visible assignment branch cannot be read', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string, hot: boolean, mystery: Record<string, never>) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        let patch = { uid };
        if (hot) patch = mystery;
        await ref.set(patch, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });
});

describe('union narrowing on a readable discriminant', () => {
  it('narrows a discriminated union to the member the payload names', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(id: string) {
        await db.doc(toPath(PATH_BUILDERS.pendingMedia(id))).set(
          { status: 'processing', completedAt: Date.now() },
          { merge: true },
        );
      }
    `);
    expect(detailsOf(result)).toContain("'completedAt' is not declared");
  });

  it('keeps the any-member rule when no discriminant literal is readable', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(id: string, status: string) {
        await db.doc(toPath(PATH_BUILDERS.pendingMedia(id))).set(
          { status, completedAt: Date.now() },
          { merge: true },
        );
      }
    `);
    expect(detailsOf(result)).not.toContain('completedAt');
  });

  it('narrowedDeclaredKeys returns null when nothing narrows', () => {
    const schema = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('one'), a: z.string() }),
      z.object({ kind: z.literal('two'), b: z.string() }),
    ]);
    expect(narrowedDeclaredKeys(schema, new Map())).toBeNull();
    expect(
      [...(narrowedDeclaredKeys(schema, new Map([['kind', new Set(['one'])]]))?.keys ?? [])].sort(),
    ).toEqual(['a', 'kind']);
  });
});

describe('COLLECTION_REFS auto-id and preset-id references', () => {
  it('accepts an auto-id mint through a canonical collection builder', () => {
    const result = analyze(`
      import { COLLECTION_REFS, toPath } from '@fixture/core';
      const db = getFirestore();
      export async function writeIt() {
        const ref = db.collection(toPath(COLLECTION_REFS.auditEvents())).doc();
        await ref.set({ id: ref.id, correlationId: null });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.HAND_BUILT_PATH);
  });

  it('fires on an undeclared key written through that same auto-id reference', () => {
    const result = analyze(`
      import { COLLECTION_REFS, toPath } from '@fixture/core';
      const db = getFirestore();
      export async function writeIt() {
        const ref = db.collection(toPath(COLLECTION_REFS.auditEvents())).doc();
        await ref.set({ collectionRefUndeclared: true });
      }
    `);
    expect(detailsOf(result)).toContain('collectionRefUndeclared');
    expect(detailsOf(result)).toContain('auditEvents');
  });

  it('accepts a preset-id document of a canonical collection, and is not a hand-built path', () => {
    const result = analyze(`
      import { COLLECTION_REFS, toPath } from '@fixture/core';
      const db = getFirestore();
      export async function writeIt(pictureId: string) {
        await db.collection(toPath(COLLECTION_REFS.galleryPictures())).doc(pictureId).set(
          { presetIdUndeclared: true },
          { merge: true },
        );
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.HAND_BUILT_PATH);
    expect(detailsOf(result)).toContain('presetIdUndeclared');
    expect(detailsOf(result)).toContain('galleryPictures');
  });

  it('resolves the indexed single-segment form COLLECTION_REFS.x()[0]', () => {
    const result = analyze(`
      import { COLLECTION_REFS } from '@fixture/core';
      const db = getFirestore();
      export async function writeIt(id: string) {
        await db.collection(COLLECTION_REFS.sportGames()[0]).doc(id).set({ indexedFormUndeclared: 1 }, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('indexedFormUndeclared');
    expect(detailsOf(result)).toContain('sportGames/{gameId}');
  });

  it('MUST FAIL — a local object named COLLECTION_REFS is never the canonical registry', () => {
    const result = analyze(`
      import { toPath } from '@fixture/core';
      const db = getFirestore();
      const COLLECTION_REFS = { auditEvents: () => ['anyCollection'] };
      export async function writeIt() {
        const ref = db.collection(toPath(COLLECTION_REFS.auditEvents())).doc();
        await ref.set({ localRefsUndeclared: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).not.toContain('auditEvents/{');
  });

  it('MUST FAIL — a COLLECTION_REFS imported from another module is never the canonical registry', () => {
    const result = analyze(`
      import { toPath } from '@fixture/core';
      import { COLLECTION_REFS } from './look-alike';
      const db = getFirestore();
      export async function writeIt() {
        const ref = db.collection(toPath(COLLECTION_REFS.auditEvents())).doc();
        await ref.set({ foreignRefsUndeclared: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).not.toContain('auditEvents/{');
  });

  it('reads the canonical registry under a renamed import', () => {
    const result = analyze(`
      import { COLLECTION_REFS as REFS, toPath } from '@fixture/core';
      const db = getFirestore();
      export async function writeIt() {
        const ref = db.collection(toPath(REFS.auditEvents())).doc();
        await ref.set({ renamedRefsUndeclared: true });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('renamedRefsUndeclared');
    expect(detailsOf(result)).toContain('auditEvents');
  });
});

describe('computed keys drawn from a canonical core const map', () => {
  it('reads EVERY value of the map as a written key', () => {
    const result = analyze(`
      import { PATH_BUILDERS, toPath } from '@fixture/core';
      import { COLLECTION_DOC_ID_FIELDS } from '@fixture/core/doc-schemas';
      const db = getFirestore();
      export async function writeIt(uid: string, template: string) {
        await db.doc(toPath(PATH_BUILDERS.publicUser(uid))).set(
          { [COLLECTION_DOC_ID_FIELDS[template]]: uid },
          { merge: true },
        );
      }
    `);
    const write = result.writes[0];
    expect(write.keys.sort()).toEqual([...new Set(Object.values(COLLECTION_DOC_ID_FIELDS))].sort());
  });

  it('fires when ONE of the map values is undeclared by a candidate target', () => {
    const result = analyze(`
      import { PATH_BUILDERS, toPath } from '@fixture/core';
      import { COLLECTION_DOC_ID_FIELDS } from '@fixture/core/doc-schemas';
      const db = getFirestore();
      export async function writeIt(uid: string, template: string) {
        await db.doc(toPath(PATH_BUILDERS.publicUser(uid))).set(
          { [COLLECTION_DOC_ID_FIELDS[template]]: uid },
          { merge: true },
        );
      }
    `);
    expect(detailsOf(result)).toContain('eventId');
  });

  it('narrows to one entry when the selector is a readable literal', () => {
    const result = analyze(`
      import { PATH_BUILDERS, toPath } from '@fixture/core';
      import { COLLECTION_DOC_ID_FIELDS } from '@fixture/core/doc-schemas';
      const db = getFirestore();
      const TEMPLATE = 'publicUsers/{userId}';
      export async function writeIt(uid: string) {
        await db.doc(toPath(PATH_BUILDERS.publicUser(uid))).set(
          { [COLLECTION_DOC_ID_FIELDS[TEMPLATE]]: uid },
          { merge: true },
        );
      }
    `);
    expect(result.writes[0].keys).toEqual(['uid']);
  });

  it('stays fail-closed on a computed key from a LOCAL map', () => {
    const result = analyze(`${PREAMBLE}
      const LOCAL_FIELDS: Record<string, string> = { a: 'x' };
      export async function writeIt(uid: string, kind: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set({ [LOCAL_FIELDS[kind]]: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });
});

describe('an object-literal lane registry holding patches', () => {
  it('reads the patch out of a registry entry selected at runtime', () => {
    const result = analyze(`${PREAMBLE}
      const SUPPORTED = {
        accountAction: { resetPatch: { uid: 'x' } },
        notification: { resetPatch: { displayName: 'y' } },
      };
      export async function writeIt(uid: string, lane: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update(SUPPORTED[lane].resetPatch);
      }
    `);
    expect(result.violations).toEqual([]);
    expect(result.writes[0].keys.sort()).toEqual(['displayName', 'uid']);
  });

  it('fires when ONE lane entry carries an undeclared field', () => {
    const result = analyze(`${PREAMBLE}
      const SUPPORTED = {
        accountAction: { resetPatch: { uid: 'x' } },
        notification: { resetPatch: { laneUndeclared: true } },
      };
      export async function writeIt(uid: string, lane: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update(SUPPORTED[lane].resetPatch);
      }
    `);
    expect(detailsOf(result)).toContain('laneUndeclared');
  });

  it('reads a bare registry lookup used AS the payload', () => {
    const result = analyze(`${PREAMBLE}
      const PATCHES = { a: { uid: 'x' }, b: { bareLaneUndeclared: true } };
      export async function writeIt(uid: string, lane: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update(PATCHES[lane]);
      }
    `);
    expect(detailsOf(result)).toContain('bareLaneUndeclared');
  });

  it('fails closed when the lane registry exceeds the finite candidate bound', () => {
    const entries = Array.from({ length: 17 }, (_, index) => `lane${index}: { uid: 'x' }`).join(
      ',\n',
    );
    const result = analyze(`${PREAMBLE}
      const PATCHES = { ${entries} };
      export async function writeIt(uid: string, lane: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update(PATCHES[lane]);
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });
});

describe('references that come from a resolved collection query', () => {
  it('resolves snap.docs[i].ref', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt() {
        const snap = await db.collection(COLLECTIONS.PUBLIC_USERS).limit(1).get();
        await snap.docs[0].ref.set({ indexedDocUndeclared: 1 }, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('indexedDocUndeclared');
    expect(detailsOf(result)).toContain('publicUsers/{userId}');
  });

  it('resolves a transaction.get(ref) snapshot back to the document it read', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(tx: FirebaseFirestore.Transaction, uid: string) {
        const snap = await tx.get(db.doc(toPath(PATH_BUILDERS.publicUser(uid))));
        tx.set(snap.ref, { txSnapshotUndeclared: 1 }, { merge: true });
      }
    `);
    expect(detailsOf(result)).toContain('txSnapshotUndeclared');
  });

  it('resolves every reference handed to db.getAll(...)', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string, requestId: string) {
        const snaps = await db.getAll(
          db.doc(toPath(PATH_BUILDERS.publicUser(uid))),
          db.doc(toPath(PATH_BUILDERS.userPrivateData(requestId))),
        );
        for (const snap of snaps) {
          await snap.ref.set({ displayName: 'x' }, { merge: true });
        }
      }
    `);
    expect(detailsOf(result)).toContain('userProfiles/{userId}/privateData/{privateDataId}');
  });

  it('propagates a COLLECTION parameter from the call sites of a generic sweep helper', () => {
    const result = analyze(`${PREAMBLE}
      async function archiveSweep(
        source: FirebaseFirestore.CollectionReference,
        archive: FirebaseFirestore.CollectionReference,
      ) {
        const snap = await source.limit(50).get();
        for (const doc of snap.docs) {
          await doc.ref.set({ genericSweepUndeclared: 1 }, { merge: true });
          await archive.doc(doc.id).set({ uid: doc.id }, { merge: true });
        }
      }
      export async function run() {
        await archiveSweep(
          db.collection(COLLECTIONS.PUBLIC_USERS),
          db.collection(COLLECTIONS.PUBLIC_USERS),
        );
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('genericSweepUndeclared');
  });

  it('checks a collectionGroup write against EVERY template ending in that collection', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt() {
        const snap = await db.collectionGroup('privateData').limit(10).get();
        snap.forEach((doc) => { void doc.ref.set({ displayName: 'x' }, { merge: true }); });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
  });
});

describe('callback-supplied payloads in a generic helper', () => {
  it('resolves the callback result from the call site', () => {
    const result = analyze(`${PREAMBLE}
      async function sweep(
        ref: FirebaseFirestore.DocumentReference,
        transform: (id: string) => Record<string, unknown>,
      ) {
        await ref.set(transform(ref.id), { merge: true });
      }
      export async function run(uid: string) {
        await sweep(db.doc(toPath(PATH_BUILDERS.publicUser(uid))), (id) => ({ uid: id }));
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('fires on an undeclared key produced by that callback', () => {
    const result = analyze(`${PREAMBLE}
      async function sweep(
        ref: FirebaseFirestore.DocumentReference,
        transform: (id: string) => Record<string, unknown>,
      ) {
        await ref.set(transform(ref.id), { merge: true });
      }
      export async function run(uid: string) {
        await sweep(db.doc(toPath(PATH_BUILDERS.publicUser(uid))), (id) => ({ callbackResultUndeclared: id }));
      }
    `);
    expect(detailsOf(result)).toContain('callbackResultUndeclared');
  });

  it('stays fail-closed when the callback is not a syntactically finite function', () => {
    const result = analyze(`${PREAMBLE}
      declare const opaqueTransform: (id: string) => Record<string, unknown>;
      async function sweep(
        ref: FirebaseFirestore.DocumentReference,
        transform: (id: string) => Record<string, unknown>,
      ) {
        await ref.set(transform(ref.id), { merge: true });
      }
      export async function run(uid: string) {
        await sweep(db.doc(toPath(PATH_BUILDERS.publicUser(uid))), opaqueTransform);
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });
});

describe('a payload built by a PACKAGE function', () => {
  const source = `${PREAMBLE}
    import { buildPendingMediaTerminalFields } from '@fixture/media';
    export async function writeIt(uid: string, nowMs: number) {
      const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      await ref.set(buildPendingMediaTerminalFields('completed', {}, nowMs), { merge: true });
    }
  `;

  it('is unreadable without a reviewed entry — there is no "trust any package call" rule', () => {
    expect(kindsOf(analyze(source))).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('reads the keys the PACKAGE declares, and diffs exactly those', () => {
    const entry = {
      kind: VIOLATION_KINDS.PACKAGE_BUILDER,
      file: 'fixture/writer.ts',
      callee: 'buildPendingMediaTerminalFields',
      module: '@fixture/media',
      args: ["'completed'", '{}', 'nowMs'],
      schema: 'PendingMediaCompletedSchema',
      why: 'fixture — the entry names the schema the DECLARED keys must fit',
    };
    const result = analyze(source, { exceptions: [entry] });
    expect(result.staleExceptions).toEqual([]);
    expect(result.writes[0].keys).toContain('terminalAt');
    expect(result.writes[0].keys).not.toContain('originalFileName');
    expect(detailsOf(result)).toContain('terminalAt');
  });

  it('does not let the entry cover a DIFFERENT callee in the same file', () => {
    const result = analyze(
      `${PREAMBLE}
        import { buildPendingMediaTerminalFields, buildSomethingElse } from '@fixture/media';
        export async function writeIt(uid: string, nowMs: number) {
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          await ref.set(buildPendingMediaTerminalFields('completed', {}, nowMs), { merge: true });
          await ref.set(buildSomethingElse(uid).doc, { merge: true });
        }
      `,
      {
        exceptions: [
          {
            kind: VIOLATION_KINDS.PACKAGE_BUILDER,
            file: 'fixture/writer.ts',
            callee: 'buildPendingMediaTerminalFields',
            module: '@fixture/media',
            args: ["'completed'", '{}', 'nowMs'],
            schema: 'PublicUserSchema',
            why: 'fixture',
          },
        ],
      },
    );
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
    expect(detailsOf(result)).toContain('buildSomethingElse');
  });

  describe('an OVERLOADED builder, bound to one exact call by `args`', () => {
    const terminal = (args: string) => `${PREAMBLE}
      import { buildPendingMediaTerminalFields } from '@fixture/media';
      export async function writeIt(id: string, nowMs: number) {
        const ref = db.doc(toPath(PATH_BUILDERS.pendingMedia(id)));
        await ref.update({ ...buildPendingMediaTerminalFields(${args}) });
      }
    `;
    const entry = {
      kind: VIOLATION_KINDS.PACKAGE_BUILDER,
      file: 'fixture/writer.ts',
      callee: 'buildPendingMediaTerminalFields',
      module: '@fixture/media',
      args: ["'completed'", '{}', 'nowMs'],
      schema: 'PendingMediaCompletedSchema',
      why: 'fixture — bound to the call that selects the first overload',
    };

    it('reads the first overload’s declared keys for the bound call and diffs them', () => {
      const result = analyze(terminal("'completed', {}, nowMs"), { exceptions: [entry] });
      expect(result.violations).toEqual([]);
      expect(result.staleExceptions).toEqual([]);
      expect(result.writes[0].keys.sort()).toEqual([
        'completedAt',
        'status',
        'terminalAt',
        'updatedAt',
      ]);
    });

    it('does not cover the same builder called for ANOTHER status', () => {
      const result = analyze(terminal("'failed', {}, nowMs"), { exceptions: [entry] });
      expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
      expect(result.staleExceptions.length).toBe(1);
    });

    it('does not cover a call that passes extra fields', () => {
      const result = analyze(terminal("'completed', { result }, nowMs"), { exceptions: [entry] });
      expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
      expect(result.staleExceptions.length).toBe(1);
    });
  });

  it('reports the entry as STALE when nothing matches it', () => {
    const result = analyze(
      `${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.set({ uid }, { merge: true });
      }
    `,
      {
        exceptions: [
          {
            kind: VIOLATION_KINDS.PACKAGE_BUILDER,
            file: 'fixture/writer.ts',
            callee: 'goneFromTheTree',
            module: '@fixture/media',
            schema: 'PublicUserSchema',
            why: 'fixture',
          },
        ],
      },
    );
    expect(result.staleExceptions.length).toBe(1);
  });
});

describe('a generic pending-write sink', () => {
  const queue = (patch: string) => `${PREAMBLE}
    type PendingWrite = { op: 'set' | 'update'; ref: FirebaseFirestore.DocumentReference; data: unknown };
    async function commitWrites(writes: PendingWrite[]) {
      for (let i = 0; i < writes.length; i += 400) {
        const batch = db.batch();
        for (const w of writes.slice(i, i + 400)) {
          if (w.op === 'update') batch.update(w.ref, w.data);
          else batch.set(w.ref, w.data);
        }
        await batch.commit();
      }
    }
    export async function run(uid: string) {
      const pending: PendingWrite[] = [];
      pending.push({ op: 'update', ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), data: ${patch} });
      await commitWrites(pending);
    }
  `;

  it('resolves each queued { ref, data } pair at its CONSTRUCTION site', () => {
    const result = analyze(queue('{ displayName: "x" }'));
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('fires on an undeclared key in a queued payload', () => {
    const result = analyze(queue('{ queuedUndeclared: 1 }'));
    expect(detailsOf(result)).toContain('queuedUndeclared');
  });
});

describe('conditional-spread patches that omit a key', () => {
  it('reads both branches of a `...(cond ? { a, b } : {})` patch', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string, deadLetter: boolean) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update({
          uid,
          ...(deadLetter ? { status: 'dead', deadLetterAt: Date.now() } : {}),
        });
      }
    `);
    expect(detailsOf(result)).toContain('deadLetterAt');
    expect(result.writes[0].keys.sort()).toEqual(['deadLetterAt', 'status', 'uid']);
  });
});

describe('a canonical collection owned by one helper', () => {
  const source = (payload: string) => `${PREAMBLE}
    import { COLLECTION_REFS } from '@fixture/core';
    function galleryPicturesCollection() {
      return db.collection(toPath(COLLECTION_REFS.galleryPictures()));
    }
    export async function writeIt(presetPictureId?: string) {
      const picturesCol = galleryPicturesCollection();
      const pictureRef = presetPictureId ? picturesCol.doc(presetPictureId) : picturesCol.doc();
      await pictureRef.set(${payload});
    }
  `;

  it('resolves through the helper and is not a hand-built path at either id form', () => {
    const result = analyze(source("{ ownerId: 'p' }"));
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.HAND_BUILT_PATH);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('fires on an undeclared key written through it', () => {
    expect(detailsOf(analyze(source('{ helperCollectionUndeclared: 1 }')))).toContain(
      'helperCollectionUndeclared',
    );
  });
});

describe('a shared patch builder whose field NAME its callers supply', () => {
  const source = (field: string) => `${PREAMBLE}
    function genericResetPatch(statusField: string, activeValue: string) {
      return { [statusField]: activeValue };
    }
    const LANES = { one: { statusField: '${field}', activeValue: 'x', build: PATH_BUILDERS.publicUser } };
    export async function writeIt(uid: string, lane: string) {
      const entry = LANES[lane];
      const ref = db.doc(toPath(entry.build(uid)));
      await ref.update(genericResetPatch(entry.statusField, entry.activeValue));
    }
  `;

  it('reads the key from every name a call site can pass', () => {
    expect(analyze(source('displayName')).violations).toEqual([]);
  });

  it('fires when a supplied name is not declared', () => {
    expect(detailsOf(analyze(source('laneFieldUndeclared')))).toContain('laneFieldUndeclared');
  });
});

describe('a generic pending-write sink built across files', () => {
  const sources = (payload: string) => ({
    'fixture/helpers.ts': `${PREAMBLE}
      export type PendingWrite = { op: 'update'; ref: FirebaseFirestore.DocumentReference; data: unknown };
      export async function commitWrites(writes: PendingWrite[]) {
        const batch = db.batch();
        for (const w of writes.slice(0, 400)) batch.update(w.ref, w.data);
        await batch.commit();
      }
      export function buildPage(uid: string): { writes: PendingWrite[]; media: number } {
        const writes: PendingWrite[] = [];
        writes.push({ op: 'update', ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), data: { displayName: 'x' } });
        return { writes, media: 1 };
      }
    `,
    'fixture/writer.ts': `${PREAMBLE}
      import { commitWrites, buildPage } from './helpers';
      export async function run(uid: string) {
        const { writes } = buildPage(uid);
        writes.push({ op: 'update', ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), data: ${payload} });
        await commitWrites(writes);
      }
    `,
  });

  it('resolves every queued pair at its own construction site', () => {
    expect(analyzeSources(sources("{ displayName: 'y' }")).violations).toEqual([]);
  });

  it('fires on an undeclared key queued by the CALLER', () => {
    expect(detailsOf(analyzeSources(sources('{ callerQueuedUndeclared: 1 }')))).toContain(
      'callerQueuedUndeclared',
    );
  });
});

describe('a row read back from a registered document', () => {
  it('contributes exactly that document schema declared keys', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        const row = (await ref.get()).data() as { uid?: string };
        await ref.set({ ...row, displayName: 'x' });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
    expect(result.violations).toEqual([]);
  });

  it('still fires on a key the writer ADDS beside the read-back row', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        const row = (await ref.get()).data() as { uid?: string };
        await ref.set({ ...row, readBackUndeclared: 1 });
      }
    `);
    expect(detailsOf(result)).toContain('readBackUndeclared');
  });
});

describe('a query a helper merely runs and hands back', () => {
  it('resolves at the CALL SITE, never through the union of every caller query', () => {
    const result = analyze(`${PREAMBLE}
      import { SPORT_GAME_SUBCOLLECTIONS } from '@fixture/core';
      async function runOrCapture(query: FirebaseFirestore.Query) {
        try { return await query.get(); } catch { return null; }
      }
      export async function writeIt(uid: string) {
        const other = await runOrCapture(db.collection(COLLECTIONS.PUBLIC_USERS).where('disabled', '==', true));
        if (other) for (const d of other.docs) await d.ref.update({ displayName: 'x' });
        const msgs = await runOrCapture(
          db.collectionGroup(SPORT_GAME_SUBCOLLECTIONS.GAME_STAT_EVENTS).where('recordedByUserId', '==', uid),
        );
        if (msgs) for (const m of msgs.docs) await m.ref.update({ passThroughUndeclared: 1 });
      }
    `);
    expect(detailsOf(result)).toContain('passThroughUndeclared');
    expect(detailsOf(result)).toContain('gameStatEvents');
    expect(detailsOf(result)).not.toContain('publicUsers');
  });
});

describe('a carrier built in one array, spread into a second, read back in a later loop', () => {
  const source = (payload: string) => `${PREAMBLE}
    export async function writeIt(tx: FirebaseFirestore.Transaction, uid: string, ids: string[]) {
      const col = db.collection(COLLECTIONS.PUBLIC_USERS);
      const docs = await Promise.all(ids.map((id) => col.doc(id).get()));
      const candidates: Array<{ ref: FirebaseFirestore.DocumentReference; order: number }> = [];
      for (const doc of docs) candidates.push({ ref: doc.ref, order: 1 });
      const live: typeof candidates = [];
      for (const candidate of candidates) live.push({ ...candidate, order: 2 });
      for (const candidate of live) tx.update(candidate.ref, ${payload});
    }
  `;

  it('follows the ref through both arrays and the override spread', () => {
    const result = analyze(source("{ displayName: 'x' }"));
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('fires on an undeclared key written through that carrier', () => {
    expect(detailsOf(analyze(source('{ carriedThroughUndeclared: 1 }')))).toContain(
      'carriedThroughUndeclared',
    );
  });

  it('still fails closed when an UNREADABLE spread can replace the carrier ref', () => {
    const result = analyze(`${PREAMBLE}
      declare function replacement(): { ref: FirebaseFirestore.DocumentReference };
      export function writeIt(tx: FirebaseFirestore.Transaction, uid: string, replace: boolean) {
        const live = [{ ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), ...(replace ? replacement() : {}) }];
        for (const candidate of live) tx.update(candidate.ref, { uid });
      }
    `);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

describe('a lane registry whose entries hold their own path builder', () => {
  const source = (payload: string) => `${PREAMBLE}
    const laneBuild = (id: string) => PATH_BUILDERS.publicUser(id);
    const SUPPORTED = {
      one: { build: PATH_BUILDERS.sportGame, statusField: 'status' },
      two: { build: laneBuild, statusField: 'status' },
    };
    function resolveTarget(lane: string, docId: string) {
      const entry = SUPPORTED[lane];
      return { entry, ref: db.doc(toPath(entry.build(docId))) };
    }
    export async function writeIt(tx: FirebaseFirestore.Transaction, lane: string, docId: string) {
      const { ref } = resolveTarget(lane, docId);
      tx.update(ref, ${payload});
    }
  `;

  it('resolves every lane, whether the entry names a canonical builder or a local one', () => {
    const result = analyze(source("{ uid: 'x' }"));
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('sportGames/{gameId}');
  });

  it('fires on a key no lane declares', () => {
    expect(detailsOf(analyze(source('{ laneRegistryUndeclared: 1 }')))).toContain(
      'laneRegistryUndeclared',
    );
  });

  it('an entry that readably LACKS an optional property is skipped, not treated as unreadable', () => {
    const result = analyze(`${PREAMBLE}
      const LANES = {
        one: { build: PATH_BUILDERS.publicUser, patch: () => ({ displayName: 'x' }) },
        two: { build: PATH_BUILDERS.publicUser },
      };
      export async function writeIt(tx: FirebaseFirestore.Transaction, lane: string, id: string) {
        const entry = LANES[lane];
        tx.update(db.doc(toPath(entry.build(id))), entry.patch?.() ?? { uid: id });
      }
    `);
    expect(result.violations).toEqual([]);
  });
});

describe('a lane factory handed a canonical builder or a local function that parses, then builds', () => {
  const source = (payload: string, parsedBuild = 'PATH_BUILDERS.publicUser(uid)') => `${PREAMBLE}
    function lane(build: (docId: string) => [string, string], statusField: string) {
      return { build, statusField };
    }
    function parsedUserPath(docId: string): [string, string] {
      const uid = docId.split(':')[0];
      if (!uid) throw new Error('not a lane id');
      return ${parsedBuild};
    }
    const SUPPORTED = {
      games: lane(PATH_BUILDERS.sportGame, 'status'),
      users: lane(parsedUserPath, 'status'),
    };
    export async function writeIt(tx: FirebaseFirestore.Transaction, which: string, docId: string) {
      const entry = SUPPORTED[which];
      tx.update(db.doc(toPath(entry.build(docId))), ${payload});
    }
  `;

  it('resolves both lanes to their registered documents', () => {
    const result = analyze(source("{ uid: 'x' }"));
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('sportGames/{gameId}');
  });

  it('MUST FAIL — a field neither lane declares', () => {
    expect(detailsOf(analyze(source('{ laneFactoryUndeclared: 1 }')))).toContain(
      'laneFactoryUndeclared',
    );
  });

  it('MUST FAIL — a local function that hand-builds its path stays unresolved', () => {
    const result = analyze(source("{ uid: 'x' }", "['publicUsers', uid] as [string, string]"));
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });
});

describe('MUST FAIL — spellings and shapes a plain-spelling reader misses', () => {
  const undeclaredThrough = (body: string) => `${PREAMBLE}
    export async function writeIt(uid: string) {
      const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      ${body}
    }
  `;

  it("a bracket call `ref['set'](…)` is the same write as `ref.set(…)`", () => {
    const result = analyze(
      undeclaredThrough("await ref['set']({ uid, bracketUndeclared: 1 }, { merge: true });"),
    );
    expect(detailsOf(result)).toContain('bracketUndeclared');
  });

  it('the independent cross-check sees the bracket call too', () => {
    const source = undeclaredThrough("await ref['set']({ uid }, { merge: true });");
    const sites = enumerateWriteCallSites([parseFile('fixture/writer.ts', source)]);
    expect(sites).toHaveLength(1);
  });

  const dynamicWriteForms = [
    {
      name: 'a ternary selector',
      body: "await ref[uid ? 'set' : 'update']({ uid, ternaryMethodUndeclared: 1 }, { merge: true });",
      field: 'ternaryMethodUndeclared',
    },
    {
      name: 'a const assigned from a ternary',
      body: "const method = uid ? 'set' : 'update';\n      await ref[method]({ uid, constTernaryUndeclared: 1 }, { merge: true });",
      field: 'constTernaryUndeclared',
    },
    {
      name: 'a selector passed as a function parameter',
      body: "const stamp = (method: 'set' | 'update') => ref[method]({ uid, parameterMethodUndeclared: 1 }, { merge: true });\n      await stamp('set');",
      field: 'parameterMethodUndeclared',
    },
    {
      name: 'an object lookup',
      body: "const methods = { full: 'set', patch: 'update' } as const;\n      await ref[methods[uid ? 'full' : 'patch']]({ uid, objectMethodUndeclared: 1 }, { merge: true });",
      field: 'objectMethodUndeclared',
    },
    {
      name: 'an array lookup',
      body: "const methods = ['set', 'update'] as const;\n      await ref[methods[uid ? 0 : 1]]({ uid, arrayMethodUndeclared: 1 }, { merge: true });",
      field: 'arrayMethodUndeclared',
    },
    {
      name: 'a template-string selector',
      body: "await ref[`s${'et'}`]({ uid, templateMethodUndeclared: 1 }, { merge: true });",
      field: 'templateMethodUndeclared',
    },
    {
      name: 'a cast wrapper around a LITERAL selector',
      body: "await ref['set' as 'set']({ uid, castMethodUndeclared: 1 }, { merge: true });",
      field: 'castMethodUndeclared',
    },
    {
      name: 'the optional-chain AST form around a LITERAL selector',
      body: "await ref?.['set']?.({ uid, optionalMethodUndeclared: 1 }, { merge: true });",
      field: 'optionalMethodUndeclared',
    },
    {
      name: 'Reflect.apply',
      body: 'await Reflect.apply(ref.set, ref, [{ uid, reflectMethodUndeclared: 1 }, { merge: true }]);',
      field: 'reflectMethodUndeclared',
    },
  ];

  it.each(dynamicWriteForms)(
    '$name is classified and its payload is checked',
    ({ body, field }) => {
      const result = analyze(undeclaredThrough(body));
      expect(detailsOf(result)).toContain(field);
    },
  );

  it.each(dynamicWriteForms)('the independent cross-check sees $name', ({ body }) => {
    const source = undeclaredThrough(body);
    const sites = enumerateWriteCallSites([parseFile('fixture/writer.ts', source)]);
    expect(sites).toHaveLength(1);
  });

  it('`.bind` defers the payload, so the bind SITE is where it must be accounted for', () => {
    const result = analyze(
      undeclaredThrough(
        'const w = ref.set.bind(ref);\n      await w({ uid, boundUndeclared: 1 }, { merge: true });',
      ),
    );
    expect(result.writes.length).toBeGreaterThan(0);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('`.call` writes the SAME document, and its payload is read', () => {
    const result = analyze(
      undeclaredThrough(
        'const { set } = ref;\n      await set.call(ref, { uid, calledUndeclared: 1 }, { merge: true });',
      ),
    );
    expect(detailsOf(result)).toContain('calledUndeclared');
  });

  it('`.apply` reads the payload out of its argument array', () => {
    const result = analyze(
      undeclaredThrough(
        'await ref.set.apply(ref, [{ uid, appliedUndeclared: 1 }, { merge: true }]);',
      ),
    );
    expect(detailsOf(result)).toContain('appliedUndeclared');
  });

  it('a DocumentReference named `t` is a reference, not a transaction', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const t = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await t.set({ uid, txNameUndeclared: 1 });
      }
    `);
    expect(detailsOf(result)).toContain('txNameUndeclared');
  });

  it('a reference named `b` registers as a write as well', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const b = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await b.update({ bNameUndeclared: 1 });
      }
    `);
    expect(detailsOf(result)).toContain('bNameUndeclared');
  });

  it('a transaction named nothing in particular is still a transaction', () => {
    const result = analyze(`${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await db.runTransaction(async (zz) => {
          zz.set(ref, { uid, oddTxUndeclared: 1 }, { merge: true });
        });
      }
    `);
    expect(detailsOf(result)).toContain('oddTxUndeclared');
    expect(detailsOf(result)).toContain('publicUsers/{userId}');
  });

  it('argument SHAPE never drops a call whose receiver did not resolve', () => {
    const result = analyze(`${PREAMBLE}
      declare function mergeOpts(): FirebaseFirestore.SetOptions;
      export function stamp(mystery: unknown) {
        void (mystery as FirebaseFirestore.DocumentReference).set({ shapeUndeclared: 1 }, mergeOpts());
      }
    `);
    expect(result.writes.length).toBeGreaterThan(0);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('a two-argument create() on an unresolved receiver is not dropped either', () => {
    const result = analyze(`${PREAMBLE}
      export function stamp(ref: FirebaseFirestore.DocumentReference) {
        void ref.create({ createShapeUndeclared: 1 }, {});
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('a DOTTED COMPUTED key in a merge-set is a literal field name, not a path', () => {
    const result = analyze(
      undeclaredThrough('await ref.set({ [`displayName.${uid}`]: 1 }, { merge: true });'),
    );
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('the same key in an update() IS the top-level field before the dot', () => {
    const result = analyze(undeclaredThrough('await ref.update({ [`displayName.${uid}`]: 1 });'));
    expect(result.violations).toEqual([]);
    expect(result.writes[0].keys).toEqual(['displayName']);
  });

  it('a `.current` on an opaque holder is not evidence of anything', () => {
    const result = analyze(`${PREAMBLE}
      export function stamp(holder: { current: FirebaseFirestore.DocumentReference }) {
        void holder.current.set({ currentUndeclared: 1 }, { merge: true });
      }
    `);
    expect(result.writes.length).toBeGreaterThan(0);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('a `.get()` lookup on an opaque container is not evidence either', () => {
    const result = analyze(`${PREAMBLE}
      export function stamp(holder: { get(key: string): FirebaseFirestore.DocumentReference }) {
        void holder.get('k').set({ lookupUndeclared: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('but a RESOLVED Map/Set container still drops, with its evidence named', () => {
    const result = analyze(`
      export function mark(id: string) {
        const seen = new Map<string, Set<string>>();
        seen.get(id)?.add(id);
      }
    `);
    expect(result.writes).toEqual([]);
    expect(result.notFirestore.map((entry) => entry.reason).join(' ')).toContain('new Map()');
  });

  it('an ANGLE-BRACKET cast raises payload-cast like an `as` cast', () => {
    const result = analyze(
      undeclaredThrough(
        'await ref.set(<Record<string, unknown>>{ uid, angleUndeclared: 1 }, { merge: true });',
      ),
    );
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.PAYLOAD_CAST);
  });
});

describe('reviewed exception field binding', () => {
  it('cannot reuse an exception for a different undeclared field at the same write site', () => {
    const source = `${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update({ unrelatedUndeclared: 1 });
      }
    `;
    const result = analyze(source, {
      exceptions: [
        {
          kind: VIOLATION_KINDS.UNDECLARED_FIELD,
          file: 'fixture/writer.ts',
          fn: 'writeIt',
          marker: 'ref.update',
          field: 'someOtherField',
          why: 'fixture',
        },
      ],
    });
    expect(detailsOf(result)).toContain('unrelatedUndeclared');
    expect(result.applied).toEqual([]);
  });

  it('makes the old exception stale when its write site disappears and rejects the same field elsewhere', () => {
    const source = `${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update({ reusableUndeclared: 1 });
      }
    `;
    const result = analyze(source, {
      exceptions: [
        {
          kind: VIOLATION_KINDS.UNDECLARED_FIELD,
          file: 'fixture/writer.ts',
          fn: 'writeIt',
          marker: 'oldRef.update',
          field: 'reusableUndeclared',
          why: 'fixture',
        },
      ],
    });
    expect(detailsOf(result)).toContain('reusableUndeclared');
    expect(result.applied).toEqual([]);
    expect(result.staleExceptions).toHaveLength(1);
  });

  it('makes an exception stale when its write site disappears and rejects the same field elsewhere', () => {
    const source = `${PREAMBLE}
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await ref.update({ reusableUndeclared: 1 });
      }
    `;
    const result = analyze(source, {
      exceptions: [
        {
          kind: VIOLATION_KINDS.UNDECLARED_FIELD,
          file: 'fixture/writer.ts',
          fn: 'writeIt',
          marker: 'oldRef.update',
          field: 'reusableUndeclared',
          why: 'fixture',
        },
      ],
    });
    expect(detailsOf(result)).toContain('reusableUndeclared');
    expect(result.applied).toEqual([]);
    expect(result.staleExceptions).toHaveLength(1);
  });
});

describe('MUST FAIL — a computed write-method selector that does not resolve', () => {
  const throughRef = (body: string) => `${PREAMBLE}
    export async function writeIt(uid: string, m: 'set' | 'create') {
      const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      void m;
      ${body}
    }
  `;

  const unresolvedSelectorForms = [
    {
      name: 'a selector returned by a local function',
      source: `${PREAMBLE}
        const pick = () => 'set';
        export async function writeIt(uid: string) {
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          await ref[pick()]({ uid, fnSelectorUndeclared: 1 });
        }
      `,
    },
    {
      name: 'a selector imported from another module',
      source: `${PREAMBLE}
        import { OP } from './ops';
        export async function writeIt(uid: string) {
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          await ref[OP]({ uid, importedSelectorUndeclared: 1 });
        }
      `,
    },
    {
      name: 'a concatenated selector',
      source: throughRef("await ref['s' + 'et']({ uid, concatSelectorUndeclared: 1 });"),
    },
    {
      name: 'a joined-array selector',
      source: throughRef("await ref[['s','et'].join('')]({ uid, joinSelectorUndeclared: 1 });"),
    },
    {
      name: 'a method aliased off the ref and invoked through .call',
      source: throughRef(
        'const fn = ref[m];\n      await fn.call(ref, { uid, aliasedCallUndeclared: 1 });',
      ),
    },
    {
      name: 'Function.prototype.call.call of a write method',
      source: throughRef(
        'await Function.prototype.call.call(ref.set, ref, { uid, fpCallUndeclared: 1 });',
      ),
    },
    {
      name: 'a method extracted through a property descriptor',
      source: throughRef(
        "const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ref), 'set');\n" +
          '      await d!.value.call(ref, { uid, descriptorUndeclared: 1 });',
      ),
    },
    {
      name: 'a cast over a selector whose own type is a bare string',
      source: `${PREAMBLE}
        export async function writeIt(uid: string, m: string) {
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          await ref[m as 'set']({ uid, castSelectorUndeclared: 1 });
        }
      `,
    },
    {
      name: 'a selector parameter with no type annotation',
      source: `${PREAMBLE}
        export async function writeIt(uid: string, m) {
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          await ref[m]({ uid, untypedParamUndeclared: 1 });
        }
      `,
    },
    {
      name: 'an optional-chained call on an unresolvable selector',
      source: `${PREAMBLE}
        export async function writeIt(uid: string, m: string) {
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          await ref?.[m]?.({ uid, optionalUnresolvedUndeclared: 1 });
        }
      `,
    },
    {
      name: 'a selector whose alias chain exceeds the analysis ceiling',
      source: `${PREAMBLE}
        export async function writeIt(uid: string) {
          const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
          const a1 = 'set'; const a2 = a1; const a3 = a2; const a4 = a3; const a5 = a4;
          const a6 = a5; const a7 = a6; const a8 = a7; const a9 = a8; const a10 = a9;
          const a11 = a10; const a12 = a11; const a13 = a12; const a14 = a13; const a15 = a14;
          await ref[a15]({ uid, ceilingUndeclared: 1 });
        }
      `,
    },
  ];

  it.each(unresolvedSelectorForms)('$name is a violation, never silence', ({ source }) => {
    const result = analyze(source);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it.each(unresolvedSelectorForms)(
    'the independent cross-check catches $name on its own',
    ({ source }) => {
      const sites = enumerateWriteCallSites([parseFile('fixture/writer.ts', source)]);
      expect(sites.length).toBeGreaterThan(0);
    },
  );

  it('a Symbol selector is unresolvable, not absent', () => {
    const result = analyze(`${PREAMBLE}
      const KEY = Symbol('set');
      export async function writeIt(uid: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
        await (ref as any)[KEY]({ uid, symbolKeyUndeclared: 1 });
      }
    `);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

describe('MUST PASS — ordinary dispatch whose own members supply the method', () => {
  const clean = (source: string) => {
    const result = analyze(source);
    expect(result.violations).toEqual([]);
    return result;
  };

  it('an object literal whose own properties are the handlers', () => {
    clean(`${PREAMBLE}
      const handlers = { set: (p: number) => p, update: (p: number) => p };
      export function runIt(event: 'set' | 'update', payload: number) { return handlers[event](payload); }
    `);
  });

  it('a class whose own members supply the dispatched method', () => {
    clean(`${PREAMBLE}
      export class Widget {
        set(v: number) { return v; }
        update(v: number) { return v; }
        run(method: 'set' | 'update', v: number) { return this[method](v); }
      }
    `);
  });

  it('a plain object lookup table called with a runtime key', () => {
    clean(`${PREAMBLE}
      const map: Record<string, (n: number) => void> = { set: () => {} };
      export function runIt(key: string) { map[key](1); }
    `);
  });

  it('an array of functions indexed at runtime', () => {
    clean(`${PREAMBLE}
      const arr = [() => 1, () => 2];
      export function runIt(i: number) { arr[i](); }
    `);
  });

  it('a strategy table keyed by its own keyof type', () => {
    clean(`${PREAMBLE}
      const strategy = { set: (n: number) => n, add: (n: number) => n } as const;
      export function runIt(name: keyof typeof strategy, n: number) { return strategy[name](n); }
    `);
  });

  it('new Map().set(), FormData.set and URLSearchParams.set stay non-Firestore', () => {
    const result = analyze(`${PREAMBLE}
      export function runIt(fd: FormData, u: URL) {
        const m = new Map<string, number>();
        m.set('a', 1);
        fd.set('a', 'b');
        u.searchParams.set('a', 'b');
      }
    `);
    expect(result.violations).toEqual([]);
    expect(result.notFirestore.length).toBe(3);
  });

  it("a theme-core device-preference store's .set(value) is browser storage, not a Firestore write", () => {
    const result = analyze(`
      import { createDevicePreferenceStore } from '@fixture/theme/react';
      const sizeStore = createDevicePreferenceStore<string>({ storageKey: 'k', changeEvent: 'e', parse: (s) => s, serialize: (v) => v, fallback: 'm' });
      export function setSize(size: string) {
        sizeStore.set(size);
      }
    `);
    expect(result.violations).toEqual([]);
    expect(result.notFirestore.map((entry) => entry.reason).join(' ')).toContain(
      'createDevicePreferenceStore()',
    );
  });
});

describe('MUST FAIL — every candidate of a multi-candidate selector is checked', () => {
  const dotted = (selector: string) => `${PREAMBLE}
    export async function writeIt(uid: string, c: boolean, m: 'update' | 'set') {
      const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      void c; void m;
      await ref[${selector}]({ 'displayName.sub': 1 });
    }
  `;

  it.each([
    ["c ? 'update' : 'set'", 'update first'],
    ["c ? 'set' : 'update'", 'set first'],
    ['m', 'a union-typed parameter'],
  ])('fires under the set() reading of %s (%s)', (selector) => {
    const result = analyze(dotted(selector));
    expect(detailsOf(result)).toContain('displayName.sub');
  });
});

describe('the exception list binds to a structural write site', () => {
  const TWO_IDENTICAL_SNIPPETS = `${PREAMBLE}
    export async function intended(uid: string) {
      const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      const patch = { sharedSnippetUndeclared: 1 };
      await db.runTransaction(async (tx) => { tx.update(ref, patch); });
    }
    export async function unrelated(uid: string) {
      const ref = db.doc(toPath(PATH_BUILDERS.publicUser(uid)));
      const patch = { sharedSnippetUndeclared: 2 };
      await db.runTransaction(async (tx) => { tx.update(ref, patch); });
    }
  `;

  const entryFor = (
    fn: string,
    extra: Partial<WriteGuardException> = {},
  ): WriteGuardException[] => [
    {
      kind: VIOLATION_KINDS.UNDECLARED_FIELD,
      file: 'fixture/writer.ts',
      fn,
      marker: 'tx.update(ref, patch)',
      field: 'sharedSnippetUndeclared',
      why: 'fixture',
      ...extra,
    },
  ];

  it('does not let an entry bound to one function excuse the identical snippet in another', () => {
    const result = analyze(TWO_IDENTICAL_SNIPPETS, { exceptions: entryFor('intended') });
    expect(result.applied).toHaveLength(1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].at).toBe(
      result.writes.find((write) => write.fn === 'unrelated')?.at,
    );
  });

  it('reports an entry whose named function does not exist as stale', () => {
    const result = analyze(TWO_IDENTICAL_SNIPPETS, { exceptions: entryFor('renamedAway') });
    expect(result.applied).toEqual([]);
    expect(result.violations).toHaveLength(2);
    expect(result.staleExceptions).toHaveLength(1);
  });

  it('reports an OVER-STATED count as stale, so surplus wildcards cannot stand', () => {
    const result = analyze(TWO_IDENTICAL_SNIPPETS, {
      exceptions: entryFor('intended', { count: 5 }),
    });
    expect(result.staleExceptions).toHaveLength(1);
    expect(result.staleExceptions[0]).toContain('1 of 5');
  });

  it('accepts an exact count across the sites it really covers', () => {
    const exceptions = [...entryFor('intended'), ...entryFor('unrelated')];
    const result = analyze(TWO_IDENTICAL_SNIPPETS, { exceptions });
    expect(result.violations).toEqual([]);
    expect(result.staleExceptions).toEqual([]);
  });

  it('still requires a marker AND an exact field — a marker-only entry is malformed and stale', () => {
    const result = analyze(TWO_IDENTICAL_SNIPPETS, {
      exceptions: [
        {
          kind: VIOLATION_KINDS.UNDECLARED_FIELD,
          file: 'fixture/writer.ts',
          fn: 'intended',
          marker: 'tx.update(ref, patch)',
          why: 'fixture',
        },
      ],
    });
    expect(result.applied).toEqual([]);
    expect(result.violations).toHaveLength(2);
    expect(result.staleExceptions).toHaveLength(1);
  });
});

describe('the registry the guard resolves against', () => {
  it('has no registered template whose declared keys cannot be read', () => {
    const JUSTIFIED_UNDIFFABLE: string[] = [];
    const undiffable = registry.templates.filter((template) => {
      const declared = registry.declaredFor(template);
      return !declared || declared.open;
    });
    expect(undiffable.filter((template) => !JUSTIFIED_UNDIFFABLE.includes(template))).toEqual([]);
  });

  it('derives COLLECTION_REFS from core the way PATH_BUILDERS is derived', () => {
    expect(registry.collectionRefSegments.has('galleryPictures')).toBe(true);
    expect(registry.collectionRefSegments.has('auditEvents')).toBe(true);
  });

  it('maps the PATH_BUILDERS the writers use to real registry templates', () => {
    // Not an inventory (RULE-STD-QUALITY-007): one long-lived anchor per path shape.
    expect(registry.builderTemplate.get('publicUser')).toBe('publicUsers/{userId}');
    expect(registry.builderTemplate.get('userPrivateData')).toBe(
      'userProfiles/{userId}/privateData/{privateDataId}',
    );
    expect(registry.builderTemplate.get('statsBeacon')).toBe('_appConfig/statsBeacon');
  });
});

describe('MUST FAIL — the registry cannot be built from an incomplete core', () => {
  it('a core entry point that does not load fails the registry, naming it', async () => {
    const sources = {
      ...FIXTURE_SOURCES,
      subpaths: {
        '@fixture/core/notifications': () => Promise.reject(new Error('Cannot find module')),
      },
    };
    await expect(
      loadRegistry({ sources, constantMapNames: FIXTURE_CONSTANT_MAPS }),
    ).rejects.toThrow(/@fixture\/core\/notifications did not load/);
  });

  it.each(FIXTURE_CONSTANT_MAPS)(
    'a core build without the constant map %s fails the registry',
    async (name) => {
      const sources = {
        ...FIXTURE_SOURCES,
        core: async () => {
          const core: Record<string, unknown> = { ...(await FIXTURE_SOURCES.core()) };
          delete core[name];
          return core;
        },
      };
      await expect(
        loadRegistry({ sources, constantMapNames: FIXTURE_CONSTANT_MAPS }),
      ).rejects.toThrow(`the core no longer exports the constant map ${name}`);
    },
  );

  it('a core without COLLECTION_SCHEMAS fails the registry', async () => {
    const sources = { ...FIXTURE_SOURCES, docSchemas: async () => ({}) };
    await expect(
      loadRegistry({ sources, constantMapNames: FIXTURE_CONSTANT_MAPS }),
    ).rejects.toThrow(/COLLECTION_SCHEMAS/);
  });

  it('the fixture core builds the registry', async () => {
    await expect(
      loadRegistry({ sources: FIXTURE_SOURCES, constantMapNames: FIXTURE_CONSTANT_MAPS }),
    ).resolves.toBeTruthy();
  });
});

describe('a reference reached through destructuring', () => {
  it("reads a nested pattern over Promise.all as that entry's property", () => {
    const result = analyze(`${PREAMBLE}
      async function readSignup(tx: FirebaseFirestore.Transaction, leagueId: string, userId: string) {
        const ref = db.doc(toPath(PATH_BUILDERS.leagueFreeAgent(leagueId, userId)));
        const snapshot = await tx.get(ref);
        return { ref, signup: snapshot.data() };
      }
      export async function writeIt(tx: FirebaseFirestore.Transaction, leagueId: string, userId: string) {
        const [{ ref }, other] = await Promise.all([readSignup(tx, leagueId, userId), Promise.resolve(1)]);
        tx.create(ref, { leagueId, userId, nestedPatternUndeclared: 1 });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('nestedPatternUndeclared');
  });

  it("fails closed when the nested pattern's index sits past a spread", () => {
    const result = analyze(`${PREAMBLE}
      declare const rest: Promise<unknown>[];
      async function readSignup(leagueId: string, userId: string) {
        return { ref: db.doc(toPath(PATH_BUILDERS.leagueFreeAgent(leagueId, userId))) };
      }
      export async function writeIt(tx: FirebaseFirestore.Transaction, leagueId: string, userId: string) {
        const [, { ref }] = await Promise.all([...rest, readSignup(leagueId, userId)]);
        tx.create(ref, { leagueId, userId });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it("reads a for…of object pattern as the property of each element, a flatMap's returned arrays included", () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, gameIds: string[], skip: boolean) {
        const edits = gameIds.flatMap((id) => (skip ? [] : [{ id, ref: db.doc(toPath(PATH_BUILDERS.sportGame(id))) }]));
        for (const { ref } of edits) tx.update(ref, { forOfPatternUndeclared: 1 });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('forOfPatternUndeclared');
    expect(detailsOf(result)).toContain('sportGames/{gameId}');
  });

  it("reads an array callback's object pattern as the property of each element", () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, gameIds: string[]) {
        const games = gameIds.map((id) => ({ id, ref: db.doc(toPath(PATH_BUILDERS.sportGame(id))) }));
        games.forEach(({ ref }) => tx.update(ref, { callbackPatternUndeclared: 1 }));
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('callbackPatternUndeclared');
  });

  it('fails closed on a for…of pattern over elements whose ref a spread can replace', () => {
    const result = analyze(`${PREAMBLE}
      declare function replacement(): { ref: FirebaseFirestore.DocumentReference };
      export function writeIt(tx: FirebaseFirestore.Transaction, uid: string, replace: boolean) {
        const live = [{ ref: db.doc(toPath(PATH_BUILDERS.publicUser(uid))), ...(replace ? replacement() : {}) }];
        for (const { ref } of live) tx.update(ref, { uid });
      }
    `);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});

describe('the references in an array a reader hands back', () => {
  const reader = `
    interface AdditionRead { pendingRefs: FirebaseFirestore.DocumentReference[] }
    async function readAddition(tx: FirebaseFirestore.Transaction, teamId: string, early: boolean): Promise<AdditionRead> {
      if (early) return { pendingRefs: [] };
      const [invitations] = await Promise.all([
        tx.get(db.collection(toPath(COLLECTION_REFS.teamInvitations())).where('teamId', '==', teamId).limit(5)),
      ]);
      return { pendingRefs: invitations.docs.map((doc) => doc.ref) };
    }`;

  it("reads each property value's elements, through a helper's parameter, an empty branch adding none", () => {
    const result = analyze(`${PREAMBLE}
      import { COLLECTION_REFS } from '@fixture/core';
      ${reader}
      function writeAddition(tx: FirebaseFirestore.Transaction, read: AdditionRead): void {
        for (const ref of read.pendingRefs) tx.update(ref, { status: 'approved', readerArrayUndeclared: 1 });
      }
      export async function writeIt(tx: FirebaseFirestore.Transaction, teamId: string) {
        const read = await readAddition(tx, teamId, false);
        writeAddition(tx, read);
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('readerArrayUndeclared');
    expect(detailsOf(result)).toContain('teamInvitations');
  });

  it('reads a query snapshot bound by index from Promise.all', () => {
    const result = analyze(`${PREAMBLE}
      import { COLLECTION_REFS } from '@fixture/core';
      export async function writeIt(tx: FirebaseFirestore.Transaction, teamId: string) {
        const [invitations] = await Promise.all([
          tx.get(db.collection(toPath(COLLECTION_REFS.teamInvitations())).where('teamId', '==', teamId).limit(5)),
        ]);
        for (const doc of invitations.docs) tx.update(doc.ref, { indexedSnapshotUndeclared: 1 });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('indexedSnapshotUndeclared');
  });

  it('fails closed when one branch hands back an array it cannot read', () => {
    const result = analyze(`${PREAMBLE}
      declare const unknownRefs: FirebaseFirestore.DocumentReference[];
      function readAddition(early: boolean) {
        return early ? { pendingRefs: unknownRefs } : { pendingRefs: [db.doc(toPath(PATH_BUILDERS.publicUser('u')))] };
      }
      export function writeIt(tx: FirebaseFirestore.Transaction, early: boolean) {
        const read = readAddition(early);
        for (const ref of read.pendingRefs) tx.update(ref, { uid: 'u' });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });
});

describe('a Map carrier', () => {
  const reader = `
    interface Destinations { profiles: ReadonlyMap<string, { ref: FirebaseFirestore.DocumentReference }> }
    function readDestinations(userIds: string[]): Destinations {
      const refs = userIds.map((userId) => db.doc(toPath(PATH_BUILDERS.userProfile(userId))));
      const profiles = new Map<string, { ref: FirebaseFirestore.DocumentReference }>();
      userIds.forEach((userId, index) => {
        profiles.set(userId, { ref: refs[index] as FirebaseFirestore.DocumentReference });
      });
      return { profiles };
    }`;

  it('reads .get() as the entries its own .set() calls stored, through a carrier and a parameter', () => {
    const result = analyze(`${PREAMBLE}
      ${reader}
      function writeOne(tx: FirebaseFirestore.Transaction, destinations: Destinations, userId: string): void {
        const read = destinations.profiles.get(userId);
        if (read === undefined) return;
        tx.update(read.ref, { mapGetUndeclared: 1 });
      }
      export function writeIt(tx: FirebaseFirestore.Transaction, userIds: string[]) {
        writeOne(tx, readDestinations(userIds), 'u');
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('mapGetUndeclared');
    expect(detailsOf(result)).toContain('userProfiles/{userId}');
  });

  it('reads .values(), spread into an array or walked directly, as the same entries', () => {
    const result = analyze(`${PREAMBLE}
      ${reader}
      export function writeIt(tx: FirebaseFirestore.Transaction, userIds: string[]) {
        const { profiles } = readDestinations(userIds);
        for (const { ref } of [...profiles.values()].slice(0, 5)) tx.update(ref, { spreadValuesUndeclared: 1 });
        for (const { ref } of profiles.values()) tx.update(ref, { directValuesUndeclared: 1 });
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('spreadValuesUndeclared');
    expect(detailsOf(result)).toContain('directValuesUndeclared');
  });

  it('fails closed on a Map seeded through its constructor, or any receiver not provably a new Map', () => {
    const result = analyze(`${PREAMBLE}
      declare const seeded: [string, { ref: FirebaseFirestore.DocumentReference }][];
      declare function lookup(): Map<string, { ref: FirebaseFirestore.DocumentReference }>;
      export function writeIt(tx: FirebaseFirestore.Transaction) {
        const fromConstructor = new Map(seeded);
        const first = fromConstructor.get('a');
        if (first) tx.update(first.ref, { uid: 'a' });
        const second = lookup().get('b');
        if (second) tx.update(second.ref, { uid: 'b' });
      }
    `);
    expect(
      result.violations.filter((violation) => violation.kind === VIOLATION_KINDS.UNRESOLVED_TARGET),
    ).toHaveLength(2);
  });
});

describe('a queue of paths beside their payloads', () => {
  const queue = (rosterData: string) => `${PREAMBLE}
    declare const stalePaths: string[];
    function buildWrites(gameId: string, events: { eventId: string; stat: string }[]) {
      return [
        ...events.map((event) => ({ path: toPath(PATH_BUILDERS.gameStatEvent(gameId, event.eventId)), data: event })),
        { path: toPath(PATH_BUILDERS.gameRosterPlayer(gameId, 'T1', 'u')), data: ${rosterData} },
      ];
    }
    export async function writeIt(gameId: string, events: { eventId: string; stat: string }[]) {
      const operations = [...stalePaths.map((path) => ({ path, data: null })), ...buildWrites(gameId, events)];
      for (const operation of operations.slice(0, 10)) {
        const batch = db.batch();
        if (operation.data === null) batch.delete(db.doc(operation.path));
        else batch.set(db.doc(operation.path), operation.data);
      }
    }
  `;

  it('pairs db.doc(op.path) with op.data entry by entry, a null payload storing nothing', () => {
    const result = analyze(queue(`{ userId: 'u', teamId: 'T1', isGhost: false, syncedAt: 1 }`));
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).not.toContain('gameRosterPlayers');
  });

  it('still checks each payload against its own path', () => {
    const result = analyze(queue(`{ userId: 'u', queuePairUndeclared: 1 }`));
    expect(detailsOf(result)).toContain('queuePairUndeclared');
    expect(detailsOf(result)).toContain('gameRosterPlayers');
  });
});

describe('an array built entry by entry inside a callback', () => {
  it('reads a push made in a callback onto the array the function declared', () => {
    const result = analyze(`${PREAMBLE}
      import { GameRosterPlayerSchema } from '@fixture/core/doc-schemas';
      function readEntries(rows: unknown[]) {
        const entries: unknown[] = [];
        rows.forEach((row) => {
          const parsed = GameRosterPlayerSchema.safeParse(row);
          if (parsed.success) entries.push(parsed.data);
        });
        return entries;
      }
      export function writeIt(tx: FirebaseFirestore.Transaction, gameId: string, rows: unknown[]) {
        for (const entry of readEntries(rows)) {
          tx.set(db.doc(toPath(PATH_BUILDERS.gameRosterPlayer(gameId, 'T1', 'u'))), entry);
        }
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it("never folds another function's same-named array into it", () => {
    const result = analyze(`${PREAMBLE}
      function other() {
        const entries: unknown[] = [];
        entries.push({ otherFunctionUndeclared: 1 });
        return entries;
      }
      function readEntries() {
        const entries: { uid: string }[] = [];
        [1].forEach(() => entries.push({ uid: 'u' }));
        return entries;
      }
      export function writeIt(tx: FirebaseFirestore.Transaction) {
        other();
        for (const entry of readEntries()) tx.set(db.doc(toPath(PATH_BUILDERS.publicUser('u'))), entry);
      }
    `);
    expect(detailsOf(result)).not.toContain('otherFunctionUndeclared');
  });
});

describe('a parse output handed to a helper that writes it', () => {
  it("reads safeParse(...).data passed as the helper's payload argument", () => {
    const result = analyze(`${PREAMBLE}
      import { SportGameSchema } from '@fixture/core/doc-schemas';
      function writeGame(tx: FirebaseFirestore.Transaction, gameId: string, game: unknown) {
        tx.set(db.doc(toPath(PATH_BUILDERS.sportGame(gameId))), game);
      }
      export function writeIt(tx: FirebaseFirestore.Transaction, gameId: string, raw: unknown) {
        const parsed = SportGameSchema.safeParse(raw);
        if (parsed.success) writeGame(tx, gameId, parsed.data);
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('still reports the undeclared field of a carrier property handed over the same way', () => {
    const result = analyze(`${PREAMBLE}
      function writeGame(tx: FirebaseFirestore.Transaction, gameId: string, game: unknown) {
        tx.set(db.doc(toPath(PATH_BUILDERS.sportGame(gameId))), game);
      }
      export function writeIt(tx: FirebaseFirestore.Transaction, gameId: string) {
        const carrier = { game: { carrierPropertyUndeclared: 1 } };
        writeGame(tx, gameId, carrier.game);
      }
    `);
    expect(detailsOf(result)).toContain('carrierPropertyUndeclared');
  });
});

describe('positive evidence that a receiver is not Firestore', () => {
  it("reads a Hash's chained update() as the Hash", () => {
    const result = analyze(`
      import { createHash } from 'node:crypto';
      export function digest(a: string, b: string) {
        return createHash('sha1').update(a).update(b).digest('hex');
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('follows an import to a module constant built by a non-Firestore factory', () => {
    const result = analyzeSources({
      'fixture/store.ts': `
        import { createDevicePreferenceStore } from '@fixture/theme/react';
        export const collapsed = createDevicePreferenceStore<boolean>({ storageKey: 'k', changeEvent: 'e', parse: () => true, serialize: String, fallback: false });
      `,
      'fixture/writer.ts': `
        import { collapsed } from './store';
        export function toggle(value: boolean) { collapsed.set(!value); }
      `,
    });
    expect(result.violations).toEqual([]);
  });

  it('reads a table of plain values handed to a helper as no Firestore handle, and a table holding a call as unproven', () => {
    const handedTo = (table: string) => `
      declare function makeUpdater(): (value: string) => unknown;
      function send(store: { update: (value: string) => unknown }, value: string) {
        return store.update(value);
      }
      export function run(name: string) {
        return send(${table}, name);
      }
    `;
    const plain = analyze(
      handedTo(`{ title: 'Saved', nested: { count: 2 }, update: (n: string) => 'Updated ' + n }`),
    );
    expect(plain.violations).toEqual([]);
    expect(plain.notFirestore.map((entry) => entry.reason)).toContain(
      'receiver is a table of plain values',
    );
    const unproven = analyze(handedTo(`{ update: makeUpdater() }`));
    expect(kindsOf(unproven)).toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('takes a ?? only when both sides are evidence', () => {
    const proven = analyze(`
      export function count(id: string) {
        const all = new Map<string, Map<string, number>>();
        const counters = all.get(id) ?? new Map<string, number>();
        counters.set('a', 1);
      }
    `);
    expect(proven.violations).toEqual([]);
    const unproven = analyze(`${PREAMBLE}
      declare function maybeRef(): FirebaseFirestore.DocumentReference | undefined;
      export function write() {
        const target = maybeRef() ?? new Map<string, number>();
        target.set('a', 1);
      }
    `);
    expect(unproven.violations.length).toBeGreaterThan(0);
  });
});

describe("the core's own code, read as library code", () => {
  const library = (returned: string) => ({
    'packages/core/src/index.ts': "export * from './utils/index.js';\n",
    'packages/core/src/utils/index.ts': "export * from './app-config.js';\n",
    'packages/core/src/utils/app-config.ts': `
      import { AppConfigSchema } from '../doc-schemas/system.js';
      export function mergeUpdate(existing: unknown, update: unknown) {
        ${returned}
      }
      export function writesNothingHere(ref: FirebaseFirestore.DocumentReference) {
        ref.set({ libraryWriteUndeclared: 1 });
      }
    `,
  });
  const writer = `${PREAMBLE}
    import { mergeUpdate } from '@fixture/core';
    export function writeIt(tx: FirebaseFirestore.Transaction, existing: unknown, update: unknown) {
      tx.set(db.doc(toPath(PATH_BUILDERS.appConfig())), mergeUpdate(existing, update));
    }
  `;
  const analyzeWithLibrary = (returned: string) =>
    runGuardOnSources({
      sources: { 'fixture/writer.ts': writer },
      librarySources: library(returned),
      registry,
      profile: PROFILE,
    });

  it('reads a core helper through its export chain, its relative schema import being the core export', () => {
    const result = analyzeWithLibrary(
      'return AppConfigSchema.safeParse({ ...(existing as object), ...(update as object) }).data;',
    );
    expect(result.violations).toEqual([]);
    expect(result.writes[0].keys).not.toEqual([]);
  });

  it('still reports the undeclared field a core helper returns', () => {
    const result = analyzeWithLibrary('return { libraryHelperUndeclared: 1 };');
    expect(detailsOf(result)).toContain('libraryHelperUndeclared');
  });

  it("never sweeps the core's own source for writes", () => {
    const result = analyzeWithLibrary('return AppConfigSchema.safeParse(update).data;');
    expect(detailsOf(result)).not.toContain('libraryWriteUndeclared');
  });
});

describe('a converter read through its call sites', () => {
  const converter = (extra: string) => `${PREAMBLE}
    import { LeagueFreeAgentSchema } from '@fixture/core/doc-schemas';
    type Conversion = { ok: false; skipped: string } | { ok: true; signup: { leagueId: string; userId: string; createdAt: number } };
    export function toDocument(id: string, data: Record<string, unknown>): Conversion {
      const skip = (field: string): Conversion => ({ ok: false, skipped: id + field });
      if (!data.a) return skip('a');
      if (!data.b) return skip('b');
      if (!data.c) return skip('c');
      if (!data.d) return skip('d');
      if (!data.e) return skip('e');
      if (!data.f) return skip('f');
      if (!data.g) return skip('g');
      if (!data.h) return skip('h');
      const parsed = LeagueFreeAgentSchema.safeParse(data);
      if (!parsed.success) return { ok: false, skipped: id };
      ${extra}
      return { ok: true, signup: parsed.data };
    }
    export async function writeIt(docs: { id: string; data(): Record<string, unknown> }[]) {
      const conversions = await Promise.all(docs.map(async (doc) => toDocument(doc.id, doc.data())));
      const batch = db.batch();
      for (const [index] of docs.entries()) {
        const conversion = conversions[index];
        if (!conversion || !conversion.ok) continue;
        const { leagueId, userId } = conversion.signup;
        batch.set(db.doc(toPath(PATH_BUILDERS.leagueFreeAgent(leagueId, userId))), conversion.signup);
      }
    }
  `;

  it('reads conversions[index] off Promise.all, a branch without the property adding none, many calls to one closure one shape', () => {
    const result = analyze(converter(''));
    expect(result.violations).toEqual([]);
    expect(result.writes[0].keys.sort()).toEqual(['createdAt', 'leagueId', 'userId']);
  });

  it("still reports a branch's undeclared field", () => {
    const result = analyze(
      converter(
        'if (data.z) return { ok: true, signup: { ...parsed.data, converterBranchUndeclared: 1 } };',
      ),
    );
    expect(detailsOf(result)).toContain('converterBranchUndeclared');
  });
});

describe('entries tuples', () => {
  it('reads the value slot of a Map walked through [...map.entries()] and of an array walked through .entries()', () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, names: string[]) {
        const byKey = new Map<string, { userId: string; displayName: string }>();
        for (const name of names) byKey.set(name, { userId: name, displayName: name });
        const candidates = [...byKey.entries()].map(([key, reservation]) => ({ key, reservation }));
        for (const [index, candidate] of candidates.entries()) {
          tx.set(db.doc(toPath(PATH_BUILDERS.reservedDisplayName(candidate.reservation.displayName))), candidate.reservation);
        }
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
  });

  it('still reports what the Map stored', () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, names: string[]) {
        const byKey = new Map<string, { userId: string }>();
        for (const name of names) byKey.set(name, { userId: name, entriesTupleUndeclared: 1 } as never);
        for (const [key, reservation] of byKey.entries()) {
          tx.set(db.doc(toPath(PATH_BUILDERS.reservedDisplayName(key))), reservation);
        }
      }
    `);
    expect(detailsOf(result)).toContain('entriesTupleUndeclared');
  });
});

describe('payload shapes a canonical writer uses', () => {
  it('reads a picked canonical schema as exactly its picked keys, and fails closed on a key the schema lacks', () => {
    const picked = analyze(`${PREAMBLE}
      import { LandingPageConfigSchema } from '@fixture/core/doc-schemas';
      export function writeIt(tx: FirebaseFirestore.Transaction, copy: unknown) {
        const parsed = LandingPageConfigSchema.pick({ heroTitle: true }).safeParse(copy);
        if (parsed.success) tx.set(db.doc(toPath(PATH_BUILDERS.landingPageConfig())), { ...parsed.data, updatedAt: 1 }, { merge: true });
      }
    `);
    expect(picked.violations).toEqual([]);
    const unknownKey = analyze(`${PREAMBLE}
      import { LandingPageConfigSchema } from '@fixture/core/doc-schemas';
      export function writeIt(tx: FirebaseFirestore.Transaction, copy: unknown) {
        const parsed = LandingPageConfigSchema.pick({ notASchemaKey: true }).safeParse(copy);
        if (parsed.success) tx.set(db.doc(toPath(PATH_BUILDERS.landingPageConfig())), parsed.data, { merge: true });
      }
    `);
    expect(kindsOf(unknownKey)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it('reads a null branch as no field, and every other branch as written', () => {
    const result = analyze(`${PREAMBLE}
      function toBeacon(fired: boolean) {
        return fired ? { ok: true, beacon: { nullBranchUndeclared: 1 } } : { ok: true, beacon: null };
      }
      export function writeIt(fired: boolean) {
        const conversion = toBeacon(fired);
        if (conversion.beacon !== null) db.doc(toPath(PATH_BUILDERS.statsBeacon())).set(conversion.beacon);
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
    expect(detailsOf(result)).toContain('nullBranchUndeclared');
  });

  it("reads a const template key's top-level field in an update, never in a set", () => {
    const update = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, uid: string, sport: string) {
        const field = \`lifetimeStats.\${sport}\`;
        tx.update(db.doc(toPath(PATH_BUILDERS.userProfile(uid))), { [field]: 1 });
        const wrong = \`constTemplateUndeclared.\${sport}\`;
        tx.update(db.doc(toPath(PATH_BUILDERS.userProfile(uid))), { [wrong]: 1 });
      }
    `);
    expect(detailsOf(update)).toContain('constTemplateUndeclared');
    expect(detailsOf(update)).not.toContain("'lifetimeStats'");
    const set = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, uid: string, sport: string) {
        const field = \`lifetimeStats.\${sport}\`;
        tx.set(db.doc(toPath(PATH_BUILDERS.userProfile(uid))), { [field]: 1 }, { merge: true });
      }
    `);
    expect(kindsOf(set)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });

  it("reads a helper's dotted update keys when the helper's payload is written by an update", () => {
    const result = analyze(`${PREAMBLE}
      function dropMemo(uid: string) {
        return { [\`memos.\${uid}\`]: FieldValue.delete() };
      }
      export function writeIt(tx: FirebaseFirestore.Transaction, gameId: string, uid: string) {
        tx.update(db.doc(toPath(PATH_BUILDERS.sportGame(gameId))), dropMemo(uid));
      }
    `);
    expect(result.violations).toEqual([]);
  });
});

describe('Object.fromEntries', () => {
  it("reads a constant field list's names, through a spread of another list", () => {
    const result = analyze(`${PREAMBLE}
      const KEPT = ['name', 'icon'] as const;
      const COPIED = [...KEPT, 'leagueId'] as const;
      export function writeIt(tx: FirebaseFirestore.Transaction, teamId: string, team: Record<string, unknown>) {
        tx.update(db.doc(toPath(PATH_BUILDERS.leagueTeam(teamId))), Object.fromEntries(COPIED.map((field) => [field, team[field] ?? FieldValue.delete()])));
      }
    `);
    expect(result.violations).toEqual([]);
    expect(result.writes[0].keys.sort()).toEqual(['icon', 'leagueId', 'name']);
  });

  it('still reports a listed name the document does not declare', () => {
    const result = analyze(`${PREAMBLE}
      const COPIED = ['name', 'fieldListUndeclared'] as const;
      export function writeIt(tx: FirebaseFirestore.Transaction, teamId: string, team: Record<string, unknown>) {
        tx.update(db.doc(toPath(PATH_BUILDERS.leagueTeam(teamId))), Object.fromEntries(COPIED.map((field) => [field, team[field]])));
      }
    `);
    expect(detailsOf(result)).toContain('fieldListUndeclared');
  });

  it("reads each element's named property as the key, a dotted one naming its top-level field in an update", () => {
    const result = analyze(`${PREAMBLE}
      export function writeIt(tx: FirebaseFirestore.Transaction, sport: string, userIds: string[]) {
        const changes: { field: string; after: number }[] = [];
        for (const userId of userIds) changes.push({ field: \`playerStats.\${userId}\`, after: 1 });
        tx.update(db.doc(toPath(PATH_BUILDERS.sportHallOfFame(sport))), {
          ...Object.fromEntries(changes.map((change) => [change.field, change.after])),
          updatedAt: 1,
        });
      }
    `);
    expect(result.violations).toEqual([]);
  });

  it('fails closed on a key it cannot read', () => {
    const result = analyze(`${PREAMBLE}
      declare const fields: string[];
      export function writeIt(tx: FirebaseFirestore.Transaction, teamId: string) {
        tx.update(db.doc(toPath(PATH_BUILDERS.leagueTeam(teamId))), Object.fromEntries(fields.map((field) => [field, 1])));
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });
});

describe('the document a subcollection document sits under', () => {
  it("reads doc.ref.parent.parent as the parent document's template", () => {
    const result = analyze(`${PREAMBLE}
      import { COLLECTION_GROUPS } from '@fixture/core';
      export async function writeIt(tx: FirebaseFirestore.Transaction, uid: string) {
        const snapshot = await tx.get(db.collectionGroup(COLLECTION_GROUPS.GAME_ROSTER_PLAYERS).where('userId', '==', uid).limit(5));
        for (const doc of snapshot.docs) {
          const gameRef = doc.ref.parent.parent;
          if (gameRef) tx.update(gameRef, { parentGameUndeclared: 1 });
        }
      }
    `);
    expect(kindsOf(result)).not.toContain(VIOLATION_KINDS.UNRESOLVED_TARGET);
    expect(detailsOf(result)).toContain('parentGameUndeclared');
    expect(detailsOf(result)).toContain('sportGames/{gameId}');
  });
});

describe("one lookup of a core map read by a write's target and its payload", () => {
  const SLOT_PREAMBLE = `
    import { GALLERY_OWNER_PATHS, PICTURE_OWNER_PATHS, PICTURE_SLOT_OWNERS, toPath } from '@fixture/core';
    import { FieldValue } from 'firebase-admin/firestore';
    const db = getFirestore();
  `;

  it("checks each entry's document against that entry's own field", () => {
    const result = analyze(`${SLOT_PREAMBLE}
      export async function fill(kind: 'gameLocation' | 'awardDefinition', id: string, pictureId: string) {
        const slot = PICTURE_SLOT_OWNERS[kind];
        const ownerRef = db.doc(toPath(slot.ownerDoc(id)));
        await ownerRef.update({ [slot.slotField]: pictureId });
      }
    `);
    expect(result.writes).toHaveLength(1);
    expect(result.violations).toEqual([]);
  });

  it("still fails a key no entry's document declares", () => {
    const result = analyze(`${SLOT_PREAMBLE}
      export async function fill(kind: 'gameLocation' | 'awardDefinition', id: string, pictureId: string) {
        const slot = PICTURE_SLOT_OWNERS[kind];
        await db.doc(toPath(slot.ownerDoc(id))).update({ [slot.slotField]: pictureId, notASlotField: 1 });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain(
      "'notASlotField' is not declared by gameLocations/{gameLocationId}",
    );
    expect(detailsOf(result)).toContain(
      "'notASlotField' is not declared by awardDefinitions/{awardId}",
    );
    expect(detailsOf(result)).not.toContain("'pictureId'");
    expect(detailsOf(result)).not.toContain("'badgePictureId'");
  });

  it('keeps every document against every key when the target and the key are two lookups', () => {
    const result = analyze(`${SLOT_PREAMBLE}
      export async function fill(kind: 'gameLocation' | 'awardDefinition', other: 'gameLocation' | 'awardDefinition', id: string, pictureId: string) {
        await db.doc(toPath(PICTURE_SLOT_OWNERS[kind].ownerDoc(id))).update({ [PICTURE_SLOT_OWNERS[other].slotField]: pictureId });
      }
    `);
    expect(detailsOf(result)).toContain(
      "'badgePictureId' is not declared by gameLocations/{gameLocationId}",
    );
    expect(detailsOf(result)).toContain(
      "'pictureId' is not declared by awardDefinitions/{awardId}",
    );
  });

  it('keeps every document against every key when the lookup is a rebindable `let`', () => {
    const result = analyze(`${SLOT_PREAMBLE}
      export async function fill(kind: 'gameLocation' | 'awardDefinition', id: string, pictureId: string) {
        let slot = PICTURE_SLOT_OWNERS[kind];
        const ownerRef = db.doc(toPath(slot.ownerDoc(id)));
        slot = PICTURE_SLOT_OWNERS.awardDefinition;
        await ownerRef.update({ [slot.slotField]: pictureId });
      }
    `);
    expect(kindsOf(result)).not.toEqual([]);
  });

  it('judges a gallery summary written through the all-kinds map against the slot owners too', () => {
    const result = analyze(`${SLOT_PREAMBLE}
      export async function summarize(kind: 'sportLeague' | 'gameLocation', id: string, summary: unknown) {
        await db.doc(toPath(PICTURE_OWNER_PATHS[kind].ownerDoc(id))).update({ pictures: summary });
      }
    `);
    expect(detailsOf(result)).toContain("'pictures' is not declared by");
    expect(detailsOf(result)).toContain('gameLocations/{gameLocationId}');
  });

  it('passes a gallery summary written through the gallery map', () => {
    const result = analyze(`${SLOT_PREAMBLE}
      export async function summarize(kind: 'sportLeague' | 'leagueTeam' | 'landingPage', id: string, summary: unknown) {
        await db.doc(toPath(GALLERY_OWNER_PATHS[kind].ownerDoc(id))).update({ pictures: summary });
      }
    `);
    expect(result.writes).toHaveLength(1);
    expect(result.violations).toEqual([]);
  });
});

describe('a V1 source document accepts only a removal', () => {
  const V1_MODULE = 'functions/src/migration-console/actions/v1-sources.ts';
  const V1_DECLARATION = `
    export const V1_SOURCES = {
      adminList: { collection: 'roles', documentId: 'admins' },
      landingBase: { collection: 'config', documentId: 'landing' },
    };
  `;
  const WRITER = 'functions/src/migration-console/actions/fixtureWriter.ts';
  const analyzeV1 = (body: string, declaration = { [V1_MODULE]: V1_DECLARATION }) =>
    analyzeSources({
      ...declaration,
      [WRITER]: `
        import { FieldValue } from 'firebase-admin/firestore';
        import { V1_SOURCES } from './v1-sources.js';
        const db = getFirestore();
        export async function clean() {
          const source = V1_SOURCES.adminList;
          const sourceRef = db.collection(source.collection).doc(source.documentId);
          ${body}
        }
      `,
    });

  it('passes an update whose every value is a field delete', () => {
    const result = analyzeV1(
      `await sourceRef.update({ legacyField: FieldValue.delete(), other: FieldValue.delete() });`,
    );
    expect(result.writes).toHaveLength(1);
    expect(result.violations).toEqual([]);
  });

  it("leaves the document's own delete alone: it stores no field, so it is no write the guard checks", () => {
    const result = analyzeV1(`await sourceRef.delete();`);
    expect(result.writes).toEqual([]);
    expect(result.violations).toEqual([]);
  });

  it('fails an update that stores a value beside a delete', () => {
    const result = analyzeV1(
      `await sourceRef.update({ legacyField: FieldValue.delete(), stored: 'x' });`,
    );
    expect(detailsOf(result)).toContain(
      'V1_SOURCES.adminList is a V1 source document: a write may only remove from it',
    );
  });

  it('fails a merge-set even when it only deletes', () => {
    const result = analyzeV1(
      `await sourceRef.set({ legacyField: FieldValue.delete() }, { merge: true });`,
    );
    expect(detailsOf(result)).toContain(
      'V1_SOURCES.adminList is a V1 source document: a write may only remove from it',
    );
  });

  it('does not treat a path whose halves come from two entries as a V1 source document', () => {
    const result = analyzeV1(
      `await db.collection(V1_SOURCES.adminList.collection).doc(V1_SOURCES.landingBase.documentId).update({ legacyField: FieldValue.delete() });`,
    );
    expect(result.violations).not.toEqual([]);
    expect(detailsOf(result)).not.toContain('is a V1 source document');
  });

  it('does not treat a V1_SOURCES declared outside the migration console as the V1 declaration', () => {
    const result = analyzeSources({
      'functions/src/other/v1-sources.ts': V1_DECLARATION,
      [WRITER]: `
        import { FieldValue } from 'firebase-admin/firestore';
        import { V1_SOURCES } from '../../other/v1-sources.js';
        const db = getFirestore();
        export async function clean() {
          const source = V1_SOURCES.adminList;
          await db.collection(source.collection).doc(source.documentId).update({ legacyField: FieldValue.delete() });
        }
      `,
    });
    expect(result.violations).not.toEqual([]);
    expect(detailsOf(result)).not.toContain('is a V1 source document');
  });
});

describe("a core map entry's schema parse, read with that entry's path", () => {
  const PAGE_PREAMBLE = `
    import { toPath } from '@fixture/core';
    import { CONFIG_PAGE_DOCUMENTS, UNNAMED_SCHEMA_PAGE_DOCUMENTS } from '@fixture/core/doc-schemas';
    const db = getFirestore();
  `;

  it("checks each page document against its own entry's schema", () => {
    const result = analyze(`${PAGE_PREAMBLE}
      export function publish(tx: FirebaseFirestore.Transaction, id: 'landingPage' | 'rulesPage', input: unknown) {
        const page = CONFIG_PAGE_DOCUMENTS[id];
        tx.set(db.doc(toPath(page.path())), page.schema.parse(input));
      }
    `);
    expect(result.writes).toHaveLength(1);
    expect(result.violations).toEqual([]);
  });

  it('still reports a field the parse output does not carry', () => {
    const result = analyze(`${PAGE_PREAMBLE}
      export function publish(tx: FirebaseFirestore.Transaction, id: 'landingPage' | 'rulesPage', input: unknown) {
        const page = CONFIG_PAGE_DOCUMENTS[id];
        tx.set(db.doc(toPath(page.path())), { ...page.schema.parse(input), pageUndeclared: 1 });
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain('pageUndeclared');
  });

  it("diffs a document whose schema is none of the map's against every entry's fields", () => {
    const result = analyze(`${PAGE_PREAMBLE}
      import { PATH_BUILDERS } from '@fixture/core';
      export function publish(tx: FirebaseFirestore.Transaction, id: 'landingPage' | 'rulesPage', input: unknown) {
        const page = CONFIG_PAGE_DOCUMENTS[id];
        tx.set(db.doc(toPath(PATH_BUILDERS.appConfig())), page.schema.parse(input));
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNDECLARED_FIELD);
    expect(detailsOf(result)).toContain("'heroTitle' is not declared by _appConfig/app");
    expect(detailsOf(result)).toContain("'rulesText' is not declared by _appConfig/app");
  });

  it('treats an entry whose schema no core export names as unreadable', () => {
    const result = analyze(`${PAGE_PREAMBLE}
      export function publish(tx: FirebaseFirestore.Transaction, id: 'landingPage' | 'rulesPage', input: unknown) {
        const page = UNNAMED_SCHEMA_PAGE_DOCUMENTS[id];
        tx.set(db.doc(toPath(page.path())), page.schema.parse(input));
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
    expect(detailsOf(result)).toContain('payload parsed by a non-canonical or open schema');
  });

  it('treats a local map of the same shape as unreadable', () => {
    const result = analyze(`${PAGE_PREAMBLE}
      import { RulesPageSchema } from '@fixture/core/doc-schemas';
      const LOCAL_PAGES = { landingPage: { schema: RulesPageSchema }, rulesPage: { schema: RulesPageSchema } };
      export function publish(tx: FirebaseFirestore.Transaction, id: 'landingPage' | 'rulesPage', input: unknown) {
        const page = CONFIG_PAGE_DOCUMENTS[id];
        tx.set(db.doc(toPath(page.path())), LOCAL_PAGES[id].schema.parse(input));
      }
    `);
    expect(kindsOf(result)).toContain(VIOLATION_KINDS.UNREADABLE_PAYLOAD);
  });
});
