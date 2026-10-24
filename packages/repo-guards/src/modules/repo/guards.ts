import type { Absent, GenericGuardDefinition } from '../../node/suite/config.js';
import {
  entryPointGuard,
  isolatedRootsGuard,
  noOutsideCheckoutGuard,
  tsconfigAliasGuard,
  type EntryPointFacts,
  type IsolatedRootsFacts,
  type NoOutsideCheckoutFacts,
  type TsconfigAliasFacts,
} from './cross-root.js';
import { ciParityGuard, type CiParityFacts } from './ci-parity.js';
import { dependencyOverrideGuard, type DependencyOverrideFacts } from './dependency-overrides.js';
import { documentDriftGuard, type DocumentDriftFacts } from './document-drift.js';
import { envPublicValuesGuard, type EnvPublicValuesFacts } from './env-public-values.js';
import {
  installedPackagesAgnosticGuard,
  type InstalledPackagesAgnosticFacts,
} from './installed-packages-agnostic.js';
import { localOnlyVariablesGuard, type LocalOnlyVariablesFacts } from './local-only-variables.js';
import { projectScriptGuard, type ProjectScriptFacts } from './project-scripts.js';
import { secretBindingGuard, type SecretBindingFacts } from './secret-bindings.js';
import { sharedFakeGuard, type SharedFakeFacts } from './shared-fakes.js';
import { shellSafeGuard, type ShellSafeFacts } from './shell-safe.js';
import { swallowedRejectionGuard, type SwallowedRejectionFacts } from './swallowed-rejections.js';
import { testCaseModuleLoadGuard, type TestCaseModuleLoadFacts } from './test-case-module-loads.js';
import { testTimeoutGuard, type TestTimeoutFacts } from './test-timeouts.js';
import { testSourceRootGuard, type TestSourceRootFacts } from './test-source-root.js';
import { walkerReadFailureGuard, type WalkerReadFailureFacts } from './walker-read-failure.js';
import { workerBoundedBodyGuard, type WorkerBoundedBodyFacts } from './worker-bounded-body.js';
import { workerConfigGuard, type WorkerConfigFacts } from './worker-config.js';

export type RepoGuardFacts = {
  shellSafeChildProcesses: ShellSafeFacts;
  walkerReadFailure: WalkerReadFailureFacts;
  testSourceRoot: TestSourceRootFacts | Absent;
  testCaseModuleLoads: TestCaseModuleLoadFacts;
  swallowedRejections: SwallowedRejectionFacts;
  sharedFakes: SharedFakeFacts;
  testTimeouts: TestTimeoutFacts;
  localOnlyVariables: LocalOnlyVariablesFacts;
  workerConfigIsolation: WorkerConfigFacts | Absent;
  workerBoundedBody: WorkerBoundedBodyFacts | Absent;
  isolatedRoots: IsolatedRootsFacts;
  tsconfigAliasesInRoot: TsconfigAliasFacts;
  packageEntryPoints: EntryPointFacts;
  noOutsideCheckout: NoOutsideCheckoutFacts;
  projectScripts: ProjectScriptFacts | Absent;
  secretBindings: SecretBindingFacts | Absent;
  documentDrift: DocumentDriftFacts | Absent;
  envPublicValues: EnvPublicValuesFacts | Absent;
  installedPackagesAgnostic: InstalledPackagesAgnosticFacts;
  ciParity: CiParityFacts | Absent;
  dependencyOverrides: DependencyOverrideFacts | Absent;
};

export const REPO_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  shellSafeGuard,
  walkerReadFailureGuard,
  testSourceRootGuard,
  testCaseModuleLoadGuard,
  swallowedRejectionGuard,
  sharedFakeGuard,
  testTimeoutGuard,
  localOnlyVariablesGuard,
  workerConfigGuard,
  workerBoundedBodyGuard,
  isolatedRootsGuard,
  tsconfigAliasGuard,
  entryPointGuard,
  noOutsideCheckoutGuard,
  projectScriptGuard,
  secretBindingGuard,
  documentDriftGuard,
  envPublicValuesGuard,
  installedPackagesAgnosticGuard,
  ciParityGuard,
  dependencyOverrideGuard,
] as ReadonlyArray<GenericGuardDefinition<never>>);
