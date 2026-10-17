// Every generic guard the package carries. The suite runs each one against every app; an app's
// config supplies each guard's facts by its id.

import type { GenericGuardDefinition } from './config.js';
import { BACKEND_GUARDS, type BackendGuardFacts } from './modules/backend/index.js';
import { CORE_DEFINITIONS_GUARDS, type CoreDefinitionsGuardFacts } from './modules/core-definitions/index.js';
import { FIRESTORE_GUARDS, type FirestoreGuardFacts } from './modules/firestore/index.js';
import { FRONTEND_ACTIONS_GUARDS, type FrontendActionsGuardFacts } from './modules/frontend-actions/index.js';
import { FRONTEND_READS_GUARDS, type FrontendReadsGuardFacts } from './modules/frontend-reads/index.js';
import { IMPORT_PATH_GUARDS, type ImportPathGuardFacts } from './modules/import-paths/index.js';
import { REPO_GUARDS, type RepoGuardFacts } from './modules/repo/index.js';
import { UI_GUARDS, type UiGuardFacts } from './modules/ui/index.js';

export const GENERIC_GUARDS: ReadonlyArray<GenericGuardDefinition<never>> = Object.freeze([
  ...IMPORT_PATH_GUARDS,
  ...REPO_GUARDS,
  ...FIRESTORE_GUARDS,
  ...BACKEND_GUARDS,
  ...FRONTEND_READS_GUARDS,
  ...FRONTEND_ACTIONS_GUARDS,
  ...UI_GUARDS,
  ...CORE_DEFINITIONS_GUARDS,
]);

/** The facts each generic guard needs, by its id. */
export type GenericGuardFacts = ImportPathGuardFacts &
  RepoGuardFacts &
  FirestoreGuardFacts &
  BackendGuardFacts &
  FrontendReadsGuardFacts &
  FrontendActionsGuardFacts &
  UiGuardFacts &
  CoreDefinitionsGuardFacts;

const ids = new Set<string>();
for (const guard of GENERIC_GUARDS) {
  if (ids.has(guard.id)) throw new Error(`repo-guards: two generic guards share the id ${guard.id}`);
  ids.add(guard.id);
}
