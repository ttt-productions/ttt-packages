/**
 * Every generic guard the suite registers. A repository that is no app (a package monorepo) runs
 * the ones that apply to it through `registerSuiteOf`, by id, exactly as the suite runs them.
 */
export { GENERIC_GUARDS } from './registry.js';
export type { GenericGuardDefinition } from './config.js';
export { registerGuardSuite, registerSuiteOf, type GuardSuiteConfig } from './register.js';
