import { describe, expect, it } from 'vitest';
import { coreContractsGuard } from '../../src/modules/core-definitions/contracts.js';
import { writeGuard } from '../../src/modules/firestore/guard.js';
import { importPathGuard } from '../../src/modules/import-paths/guard.js';
import { tsconfigAliasGuard, entryPointGuard } from '../../src/modules/repo/cross-root.js';
import { dependencyOverrideGuard } from '../../src/modules/repo/dependency-overrides.js';
import { documentDriftGuard } from '../../src/modules/repo/document-drift.js';
import { installedPackagesAgnosticGuard } from '../../src/modules/repo/installed-packages-agnostic.js';
import { localOnlyVariablesGuard } from '../../src/modules/repo/local-only-variables.js';
import { projectScriptGuard } from '../../src/modules/repo/project-scripts.js';
import { secretBindingGuard } from '../../src/modules/repo/secret-bindings.js';
import { workerBoundedBodyGuard } from '../../src/modules/repo/worker-bounded-body.js';
import { workerConfigGuard } from '../../src/modules/repo/worker-config.js';
import { reviewedAllowlist, matchPattern } from '../../src/shapes/shapes.js';
import { navigationGuard } from '../../src/modules/ui/interaction.js';

describe('every guard refuses an entry listed twice', () => {
  it('in a reviewed list', () => {
    expect(
      localOnlyVariablesGuard.factProblems({
        deployedConfigs: ['a.yaml'],
        neverDeployed: [
          { name: 'X', why: 'w' },
          { name: 'X', why: 'w' },
        ],
        readers: [
          { owner: 'a.ts', names: ['Y'], why: 'w' },
          { owner: 'a.ts', names: ['Z'], why: 'w' },
        ],
      }),
    ).toEqual(['neverDeployed lists X twice', 'readers lists a.ts twice']);
    expect(
      workerConfigGuard.factProblems({
        configFiles: ['x.toml'],
        productionEnvironment: 'production',
        productionDestructiveMigrations: [
          { configFile: 'x.toml', tag: 'v1', key: 'deleted_classes', contents: '[]', why: 'w' },
          { configFile: 'x.toml', tag: 'v1', key: 'deleted_classes', contents: '[]', why: 'w' },
        ],
      }),
    ).toEqual(['productionDestructiveMigrations lists x.toml v1 twice']);
    expect(
      workerBoundedBodyGuard.factProblems({
        boundedReader: 'readBody',
        boundedEndpoints: [
          { file: 'a.ts', why: 'w' },
          { file: 'a.ts', why: 'w' },
        ],
        passThroughStreams: [],
      }),
    ).toEqual(['boundedEndpoints lists a.ts twice']);
    expect(
      installedPackagesAgnosticGuard.factProblems({
        packageScope: '@acme/',
        corePackage: '@acme/core',
        manifestFolders: [''],
        productNames: ['Acme', 'Acme'],
        wireTokens: [
          { token: 't', why: 'w' },
          { token: 't', why: 'w' },
        ],
      }),
    ).toEqual(['productNames lists Acme twice', 'wireTokens lists t twice']);
    expect(
      secretBindingGuard.factProblems({
        entryFactories: { onCall: 0 },
        pinnedBinders: {},
        deliberateOverDeclarations: [
          { module: 'x.ts', entry: 'e', secrets: ['A'], why: 'w' },
          { module: 'x.ts', entry: 'e', secrets: ['B'], why: 'w' },
        ],
        indirectConsumers: [],
      }),
    ).toEqual(['deliberateOverDeclarations lists x.ts#e twice']);
    const override = {
      parent: 'p',
      child: 'c',
      affected: '<2',
      manifest: 'package.json',
      installedUnder: '',
      why: 'w',
    };
    expect(dependencyOverrideGuard.factProblems({ overrides: [override, override] })).toEqual([
      'overrides lists package.json: p → c twice',
    ]);
    expect(
      importPathGuard.factProblems({
        importAliases: {},
        exceptions: [
          { file: 'a.ts', why: 'w' },
          { file: 'a.ts', why: 'w' },
        ],
      }),
    ).toEqual(['exceptions lists a.ts twice']);
  });

  it('in a name list', () => {
    expect(
      coreContractsGuard.factProblems({
        corePackage: '@fx/core',
        backendRoots: ['functions', 'functions'],
      }),
    ).toEqual(['backendRoots lists functions twice']);
    expect(
      projectScriptGuard.factProblems({
        projectIds: ['p'],
        privilegedScripts: ['s.mjs', 's.mjs', ''],
      }),
    ).toEqual(['privilegedScripts lists s.mjs twice', 'privilegedScripts holds an empty entry']);
    expect(
      writeGuard.factProblems({
        corePackage: '@fx/core',
        importAliases: {},
        transactionTypeNames: ['Tx', 'Tx'],
        handleModulePrefixes: [],
        removalOnlyTables: [],
        registrySources: { core: () => ({}), docSchemas: () => ({}) },
        constantMapNames: ['MAPS'],
        writerRoots: ['app'],
        writerAnchors: ['a.ts'],
        exceptions: [],
      }),
    ).toEqual(['transactionTypeNames lists Tx twice']);
  });
});

describe('every reviewed path is repo-relative', () => {
  it('refuses an absolute path in a reviewed list, a shape allowlist, or a named file', () => {
    expect(
      entryPointGuard.factProblems({
        packageScope: '@acme',
        serverRoots: ['functions'],
        clientRoots: ['app'],
        serverOnlyPaths: [{ path: '/src/server', why: 'w' }],
      }),
    ).toEqual([
      'serverOnlyPaths entry /src/server (/src/server) must be repo-relative and forward-slashed',
    ]);
    expect(
      tsconfigAliasGuard.factProblems({
        tsconfigs: [{ file: 'C:/repo/tsconfig.json', root: '.' }],
      }),
    ).toEqual([
      "a tsconfig entry's file (C:/repo/tsconfig.json) must be repo-relative and forward-slashed",
    ]);
    expect(
      navigationGuard.factProblems({
        helper: 'C:/repo/src/nav.tsx',
        helperExports: ['AppLink'],
        guardedNavigationOwner: '/src/nav.tsx',
      }),
    ).toEqual([
      'helper (C:/repo/src/nav.tsx) must be repo-relative and forward-slashed',
      'guardedNavigationOwner (/src/nav.tsx) must be repo-relative and forward-slashed',
    ]);
    expect(
      documentDriftGuard.factProblems({ file: 'docs/', copies: [{ name: 'a', checkout: '../a' }] }),
    ).toEqual(['file (docs/) must not end with a slash']);
    expect(() =>
      reviewedAllowlist({
        title: 'shape',
        description: 'd',
        scope: { roots: ['app'], kinds: ['code'], tests: false },
        match: matchPattern(/x/),
        allowlist: [{ path: '/abs.ts', why: 'w' }],
        samples: { flags: ['x'], passes: ['y'] },
      }),
    ).toThrow(/allowlist entry \/abs\.ts \(\/abs\.ts\) must be repo-relative and forward-slashed/);
  });
});
