import { afterEach, describe, expect, it } from 'vitest';
import { ciParityGuard } from '../../src/modules/repo/ci-parity.js';
import {
  dependencyOverrideGuard,
  overrideProblem,
} from '../../src/modules/repo/dependency-overrides.js';
import { createRepoReader } from '../../src/node/reader.js';
import { contextOf } from '../helpers/context.js';
import { tempRepo, type TempRepo } from '../helpers/temp-repo.js';
import { factProblemsOf } from '../helpers/configured.js';

let repo: TempRepo | undefined;
afterEach(() => repo?.remove());

function readerOver(files: Record<string, string>) {
  repo = tempRepo({ 'src/index.ts': 'export {};', ...files });
  return createRepoReader({
    repoRoot: repo.root,
    roots: { app: { path: 'src', anchor: 'src/index.ts' } },
  });
}

const WORKFLOW = [
  'jobs:',
  '  verify-app:',
  '    steps:',
  '      - run: npm ci',
  '      - run: npm audit --omit=dev',
  '      - run: |',
  '          npm run lint',
  '          npm run typecheck',
  '      - run: npm test',
  '        working-directory: functions',
  '  deploy:',
  '    steps:',
  '      - run: firebase deploy',
].join('\n');

describe('the local gate mirrors every check the release workflow runs', () => {
  const facts = (parity: Record<string, { stage: string } | { ciOnly: string }>) => ({
    workflow: '.github/workflows/deploy.yml',
    verifyJobPattern: '^verify-',
    selfMirrored: '^npm audit\\b',
    parity: () => parity,
  });

  it('passes a map naming every verify command, the audits mirrored by the gate itself, and deploy jobs ignored', async () => {
    const reader = readerOver({ '.github/workflows/deploy.yml': WORKFLOW });
    const [guard] = ciParityGuard.build(
      facts({
        '. :: npm ci': { ciOnly: 'a clean install on a fresh runner' },
        '. :: npm run lint ; npm run typecheck': { stage: 'lint + typecheck' },
        'functions :: npm test': { stage: 'vitest (functions)' },
      }),
    );
    expect(await guard.run(contextOf(reader))).toEqual([]);
  });

  it('FLAGS an unmirrored CI command, an entry CI no longer runs, and an entry with no stage or reason', async () => {
    const reader = readerOver({ '.github/workflows/deploy.yml': WORKFLOW });
    const [guard] = ciParityGuard.build(
      facts({
        '. :: npm ci': { ciOnly: '' },
        '. :: npm run lint ; npm run typecheck': { stage: 'lint + typecheck' },
        '. :: npm run e2e': { stage: 'e2e' },
      }),
    );
    expect(await guard.run(contextOf(reader))).toEqual([
      {
        file: '.github/workflows/deploy.yml',
        detail: 'unmirrored CI command: functions :: npm test',
      },
      { file: '(parity map)', detail: '. :: npm ci names no stage and no CI-only reason' },
      { file: '(parity map)', detail: 'stale entry: CI no longer runs . :: npm run e2e' },
    ]);
  });

  it('refuses a pattern that is no regular expression, and a missing map loader', () => {
    expect(
      factProblemsOf(ciParityGuard, {
        workflow: 'w.yml',
        verifyJobPattern: '(',
        selfMirrored: 'x',
        parity: undefined,
      }),
    ).toEqual(['verifyJobPattern is not a regular expression', 'parity needs a loader function']);
  });
});

describe('a dependency override exists exactly while it is needed', () => {
  const o = {
    parent: '@firebase/firestore',
    child: '@grpc/grpc-js',
    affected: '<1.13.6 || >=1.14.0 <1.14.5',
  };

  it('passes an override pinned to a patched range while the parent can still reach an affected version', () => {
    expect(overrideProblem(o, '~1.9.0', '~1.14.5')).toBeNull();
  });

  it('FLAGS a redundant override once the parent reaches no affected version, and one whose parent dropped the child', () => {
    expect(overrideProblem(o, '~1.14.5', '~1.14.5')).toMatch(
      /reaches no affected version: remove the override/,
    );
    expect(overrideProblem(o, undefined, '~1.14.5')).toMatch(/no longer declares @grpc\/grpc-js/);
  });

  it('treats a caret range that still spans an affected window as needing the override', () => {
    expect(overrideProblem(o, '^1.13.6', undefined)).toMatch(
      /can reach an affected version, and no override pins it/,
    );
  });

  it('FLAGS an override that admits an affected version, or is no range at all', () => {
    for (const range of ['~1.9.0', '^1.13.0', '1.14.4', '>=1.10.0', 'not-a-range']) {
      expect(overrideProblem(o, '~1.9.0', range), range).toMatch(/admits an affected version/);
    }
  });

  const firestoreOverride = {
    ...o,
    manifest: 'package.json',
    installedUnder: '',
    why: 'firestore pins an unpatched grpc line',
  };
  const rootManifest = JSON.stringify({
    overrides: { '@firebase/firestore': { '@grpc/grpc-js': '~1.14.5' } },
  });
  const lockRecording = (parent: string, childRange: string) =>
    JSON.stringify({
      lockfileVersion: 3,
      packages: { [`node_modules/${parent}`]: { dependencies: { '@grpc/grpc-js': childRange } } },
    });

  it("judges the override from the parent's range in the committed lockfile", async () => {
    const reader = readerOver({
      'package.json': rootManifest,
      'package-lock.json': lockRecording('@firebase/firestore', '~1.9.0'),
    });
    const [guard] = dependencyOverrideGuard.build({ overrides: [firestoreOverride] });
    expect(await guard.run(contextOf(reader))).toEqual([]);
  });

  it("judges an override in a folder whose dependencies are not installed, from that folder's lockfile", async () => {
    const reader = readerOver({
      'worker-a/package.json': JSON.stringify({ overrides: { miniflare: { sharp: '^0.35.5' } } }),
      'worker-a/package-lock.json': JSON.stringify({
        lockfileVersion: 3,
        packages: { 'node_modules/miniflare': { dependencies: { sharp: '0.35.4' } } },
      }),
    });
    const [guard] = dependencyOverrideGuard.build({
      overrides: [
        {
          parent: 'miniflare',
          child: 'sharp',
          affected: '<0.35.5',
          manifest: 'worker-a/package.json',
          installedUnder: 'worker-a',
          why: 'the parent pins an affected sharp',
        },
      ],
    });
    expect(await guard.run(contextOf(reader))).toEqual([]);
  });

  it('reads the range the lockfile records, never an installed copy that disagrees with it', async () => {
    const reader = readerOver({
      'package.json': rootManifest,
      'package-lock.json': lockRecording('@firebase/firestore', '~1.14.5'),
      'node_modules/@firebase/firestore/package.json': JSON.stringify({
        dependencies: { '@grpc/grpc-js': '~1.9.0' },
      }),
    });
    const [guard] = dependencyOverrideGuard.build({ overrides: [firestoreOverride] });
    expect(await guard.run(contextOf(reader))).toEqual([
      {
        file: 'package.json',
        detail:
          '@firebase/firestore now declares @grpc/grpc-js ~1.14.5, which reaches no affected version: remove the override',
      },
    ]);
  });

  it('FLAGS an override whose folder has no lockfile, or whose lockfile records no installed parent', async () => {
    const [guard] = dependencyOverrideGuard.build({ overrides: [firestoreOverride] });
    expect(await guard.run(contextOf(readerOver({ 'package.json': rootManifest })))).toEqual([
      {
        file: 'package.json',
        detail: 'package-lock.json is missing, so the override cannot be judged',
      },
    ]);
    repo?.remove();
    const unrecorded = readerOver({
      'package.json': rootManifest,
      'package-lock.json': lockRecording('firebase-admin', '~1.9.0'),
    });
    expect(await guard.run(contextOf(unrecorded))).toEqual([
      {
        file: 'package.json',
        detail:
          'package-lock.json records no installed @firebase/firestore, so the override cannot be judged',
      },
    ]);
  });

  it('refuses an override whose affected range is no semver range, or which carries no why', () => {
    expect(
      dependencyOverrideGuard.factProblems({
        overrides: [
          { ...o, affected: 'nope', manifest: 'package.json', installedUnder: '', why: '' },
        ],
      }),
    ).toEqual([
      'overrides entry package.json: @firebase/firestore → @grpc/grpc-js carries no why',
      "overrides entry package.json: @firebase/firestore → @grpc/grpc-js's affected is not a semver range",
    ]);
  });

  it('accepts one parent → child override in each manifest that carries it, and refuses a manifest listing it twice', () => {
    const sharp = {
      parent: 'miniflare',
      child: 'sharp',
      affected: '<0.35.5',
      installedUnder: '',
      why: 'the parent pins an affected sharp',
    };
    const inEach = ['worker-a/package.json', 'worker-b/package.json'].map((manifest) => ({
      ...sharp,
      manifest,
    }));
    expect(dependencyOverrideGuard.factProblems({ overrides: inEach })).toEqual([]);
    expect(dependencyOverrideGuard.factProblems({ overrides: [inEach[0], inEach[0]] })).toEqual([
      'overrides lists worker-a/package.json: miniflare → sharp twice',
    ]);
  });
});
